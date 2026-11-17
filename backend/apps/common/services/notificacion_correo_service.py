import logging
import threading
from datetime import timedelta
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import close_old_connections, transaction
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

from apps.common.models.notificacion_correo import NotificacionCorreo

logger = logging.getLogger('django')


class NotificacionCorreoService:
    """
    Servicio centralizado del Patrón Transactional Outbox para notificaciones
    institucionales por correo electrónico (Puntos 2.2 y 6).
    
    Implementa:
    - Encolado atómico dentro de la transacción de negocio con clave de idempotencia unívoca.
    - Reclamo de pendientes con select_for_update(skip_locked=True) para evitar concurrencia y bloqueos.
    - Rescate automático de estados zombi (PROCESANDO > 5 min).
    - Despacho SMTP con timeout y backoff exponencial (hasta 3 intentos).
    - Sandbox fail-safe controlado por DJANGO_DEBUG y EMAIL_DEV_OVERRIDE.
    - Generación dual HTML (Outlook) y Texto Plano para accesibilidad y entrega limpia.
    """

    @classmethod
    def encolar(
        cls,
        evento: str,
        idempotency_key: str,
        destinatarios: list,
        asunto: str,
        plantilla: str,
        contexto: dict,
        ejecutar_inmediato: bool = True
    ) -> NotificacionCorreo:
        """
        Registra la notificación en la tabla 'notificaciones_correo' dentro de la
        transacción actual. Si ya existe un registro con la misma idempotency_key,
        retorna el existente sin duplicar el correo.
        """
        destinatarios_limpios = [str(d).strip().lower() for d in destinatarios if str(d).strip()]
        
        notif, created = NotificacionCorreo.objects.get_or_create(
            idempotency_key=idempotency_key,
            defaults={
                'evento': evento,
                'destinatarios_previstos': destinatarios_limpios,
                'asunto': asunto,
                'plantilla': plantilla,
                'contexto': contexto or {},
                'estado': NotificacionCorreo.ESTADO_PENDIENTE,
            }
        )

        if created:
            logger.info(
                f"[Outbox Encolado] Notificación #{notif.id} ({evento}) para {len(destinatarios_limpios)} destinatarios. "
                f"Key: {idempotency_key}"
            )
            if ejecutar_inmediato:
                # Solo se dispara si el commit de la BD actual tiene éxito
                transaction.on_commit(lambda: cls.disparar_acelerador_inmediato())
        else:
            logger.warning(
                f"[Outbox Idempotencia] Evento duplicado detectado con key '{idempotency_key}'. "
                f"Reutilizando notificación #{notif.id} (estado: {notif.estado})."
            )

        return notif

    @classmethod
    def procesar_pendientes(cls, batch_size: int = 25) -> dict:
        """
        Procesa un lote de correos pendientes o en reintento.
        Diseñado para ser invocado tanto por el acelerador inmediato como por
        el comando periódico de cron.
        """
        summary = {
            'reclamados': 0,
            'enviados': 0,
            'fallidos': 0,
            'reintentos': 0,
            'zombies_rescatados': 0,
        }

        # ----------------------------------------------------------------------
        # PASO 1: Rescate de registros zombi (PROCESANDO con inactividad > 5 min)
        # ----------------------------------------------------------------------
        limite_zombie = timezone.now() - timedelta(minutes=5)
        zombies = NotificacionCorreo.objects.filter(
            estado=NotificacionCorreo.ESTADO_PROCESANDO,
            procesando_desde__lte=limite_zombie
        ).update(
            estado=NotificacionCorreo.ESTADO_REINTENTO,
            ultimo_error='Timeout en estado PROCESANDO superado (posible reinicio o muerte del worker). Rescatado automáticamente.',
            procesando_desde=None
        )
        if zombies > 0:
            summary['zombies_rescatados'] = zombies
            logger.warning(f"[Outbox Watchdog] {zombies} registros zombi rescatados a estado REINTENTO.")

        # ----------------------------------------------------------------------
        # PASO 2: Reclamo atómico con skip_locked=True (Cero colisiones ni locks)
        # ----------------------------------------------------------------------
        now = timezone.now()
        with transaction.atomic():
            pendientes = list(
                NotificacionCorreo.objects.select_for_update(skip_locked=True)
                .filter(
                    estado__in=[NotificacionCorreo.ESTADO_PENDIENTE, NotificacionCorreo.ESTADO_REINTENTO],
                    proximo_intento__lte=now
                )[:batch_size]
            )
            for item in pendientes:
                item.estado = NotificacionCorreo.ESTADO_PROCESANDO
                item.procesando_desde = now
                item.save(update_fields=['estado', 'procesando_desde'])

        summary['reclamados'] = len(pendientes)
        if not pendientes:
            return summary

        # ----------------------------------------------------------------------
        # PASO 3: Despacho SMTP individual sin retener locks de base de datos
        # ----------------------------------------------------------------------
        is_prod = not settings.DEBUG
        dev_override = getattr(settings, 'EMAIL_DEV_OVERRIDE', '').strip()

        for item in pendientes:
            try:
                # Evaluación de Sandbox
                if is_prod:
                    destinatarios_finales = item.destinatarios_previstos
                    asunto_final = item.asunto
                else:
                    if dev_override:
                        destinatarios_finales = [dev_override]
                    else:
                        destinatarios_finales = ['dev-sandbox@cincosas.com']
                    asunto_final = f"[SANDBOX] {item.asunto}"

                # Renderizado de plantilla HTML y extracción de texto plano
                html_body = render_to_string(item.plantilla, item.contexto)
                text_body = strip_tags(html_body)

                # Construcción del mensaje MIME multipart
                from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'CINCO S.A.S. <notificaciones@cincosas.com>')
                msg = EmailMultiAlternatives(
                    subject=asunto_final,
                    body=text_body,
                    from_email=from_email,
                    to=destinatarios_finales
                )
                msg.attach_alternative(html_body, "text/html")
                msg.send(fail_silently=False)

                # Confirmación de éxito
                item.marcar_enviado(destinatarios_reales=destinatarios_finales)
                summary['enviados'] += 1
                logger.info(f"[Outbox Enviado] Notificación #{item.id} entregada con éxito a {destinatarios_finales}.")

            except Exception as exc:
                error_str = f"{type(exc).__name__}: {str(exc)}"
                logger.error(
                    f"[Outbox Error SMTP] Falla al despachar notificación #{item.id}: {error_str}",
                    exc_info=True
                )
                item.marcar_falla(error_msg=error_str)
                if item.estado == NotificacionCorreo.ESTADO_REINTENTO:
                    summary['reintentos'] += 1
                else:
                    summary['fallidos'] += 1

        return summary

    @classmethod
    def disparar_acelerador_inmediato(cls):
        """
        Lanza un hilo demonio liviano para procesar el outbox en tiempo casi real (< 1.5s).
        Garantiza el cierre explícito de conexiones a la base de datos para prevenir fugas.
        """
        def _worker():
            try:
                close_old_connections()
                cls.procesar_pendientes(batch_size=10)
            except Exception as err:
                logger.error(f"[Outbox Acelerador] Error en despacho inmediato: {err}", exc_info=True)
            finally:
                close_old_connections()

        t = threading.Thread(target=_worker, name="outbox-fast-dispatcher", daemon=True)
        t.start()

    # --------------------------------------------------------------------------
    # MÉTODOS DE NEGOCIO DE ALTO NIVEL (Punto 2.2)
    # --------------------------------------------------------------------------

    @classmethod
    def encolar_egreso(
        cls,
        perfil,
        fecha_egreso,
        motivo: str,
        usuario_operador = None
    ) -> NotificacionCorreo:
        """
        Encola la notificación institucional de retiro de colaborador.
        Cumple estrictamente con Habeas Data: NO expone motivo_real en el correo.
        """
        laboral = getattr(perfil, 'laboral', None)
        documento = perfil.numero_documento or ''
        
        # Enmascaramiento parcial para privacidad: muestra solo últimos 4 dígitos
        if len(documento) > 4:
            doc_ofuscado = f"CC ****{documento[-4:]}"
        else:
            doc_ofuscado = f"CC {documento}"

        app_url = 'http://localhost:3000' if settings.DEBUG else 'https://frontend.cincosas.com'
        idempotency_key = f"egreso:{perfil.id}:{fecha_egreso}"
        destinatarios = getattr(settings, 'NOTIFICACION_EGRESO_TO', [])

        contexto = {
            'empleado_id': perfil.id,
            'nombre_completo': perfil.nombre_completo,
            'numero_documento': documento,
            'documento_ofuscado': doc_ofuscado,
            'cargo': laboral.cargo if laboral else '',
            'area': laboral.area if laboral else '',
            'carpeta': laboral.carpeta if laboral else '',
            'fecha_egreso': str(fecha_egreso),
            'motivo': motivo or 'Terminación formal de vínculo laboral',
            'usuario_operador': usuario_operador.get_full_name() or usuario_operador.username if usuario_operador else 'Sistema',
            'fecha_registro': timezone.now().strftime('%Y-%m-%d %H:%M'),
            'app_url': app_url,
        }

        asunto = f"NOTIFICACIÓN EGRESO - {perfil.nombre_completo} - CINCO SAS"
        plantilla = 'emails/notificacion_egreso.html'

        return cls.encolar(
            evento='EGRESO',
            idempotency_key=idempotency_key,
            destinatarios=destinatarios,
            asunto=asunto,
            plantilla=plantilla,
            contexto=contexto,
            ejecutar_inmediato=True
        )

    @classmethod
    def encolar_reactivacion(
        cls,
        perfil,
        movil_asignado: str | None = None,
        usuario_operador = None
    ) -> NotificacionCorreo:
        """
        Encola la notificación institucional de reincorporación de colaborador activo.
        """
        laboral = getattr(perfil, 'laboral', None)
        documento = perfil.numero_documento or ''
        
        if len(documento) > 4:
            doc_ofuscado = f"CC ****{documento[-4:]}"
        else:
            doc_ofuscado = f"CC {documento}"

        today_str = timezone.now().strftime('%Y-%m-%d')
        app_url = 'http://localhost:3000' if settings.DEBUG else 'https://frontend.cincosas.com'
        idempotency_key = f"reactivacion:{perfil.id}:{today_str}"
        destinatarios = getattr(settings, 'NOTIFICACION_REACTIVACION_TO', [])

        contexto = {
            'empleado_id': perfil.id,
            'nombre_completo': perfil.nombre_completo,
            'numero_documento': documento,
            'documento_ofuscado': doc_ofuscado,
            'cargo': laboral.cargo if laboral else '',
            'area': laboral.area if laboral else '',
            'carpeta': laboral.carpeta if laboral else '',
            'movil': movil_asignado or (laboral.movil if laboral else '1 - SIN ASIGNAR'),
            'fecha_reactivacion': today_str,
            'usuario_operador': usuario_operador.get_full_name() or usuario_operador.username if usuario_operador else 'Sistema',
            'fecha_registro': timezone.now().strftime('%Y-%m-%d %H:%M'),
            'app_url': app_url,
        }

        asunto = f"NOTIFICACIÓN REACTIVACIÓN - {perfil.nombre_completo} - CINCO SAS"
        plantilla = 'emails/notificacion_reactivacion.html'

        return cls.encolar(
            evento='REACTIVACION',
            idempotency_key=idempotency_key,
            destinatarios=destinatarios,
            asunto=asunto,
            plantilla=plantilla,
            contexto=contexto,
            ejecutar_inmediato=True
        )

    @classmethod
    def encolar_solicitud_traslado(
        cls,
        empleado_perfil,
        solicitante_usuario,
        nueva_area: str,
        nueva_carpeta: str,
        motivo: str
    ) -> NotificacionCorreo:
        """
        Encola la notificación de solicitud de traslado de área/carpeta hacia Gestión Humana y Programación.
        """
        laboral = getattr(empleado_perfil, 'laboral', None)
        today_str = timezone.now().strftime('%Y-%m-%d')
        solicitante_id = solicitante_usuario.id if solicitante_usuario else 0
        app_url = 'http://localhost:3000' if settings.DEBUG else 'https://frontend.cincosas.com'
        idempotency_key = f"traslado:{empleado_perfil.id}:{solicitante_id}:{today_str}"
        destinatarios = getattr(settings, 'NOTIFICACION_TRASLADO_TO', [])

        # Consultar datos del solicitante
        solicitante_perfil = getattr(solicitante_usuario, 'empleado_perfil', None)
        solicitante_lab = getattr(solicitante_perfil, 'laboral', None) if solicitante_perfil else None

        contexto = {
            'empleado_id': empleado_perfil.id,
            'empleado_nombre': empleado_perfil.nombre_completo,
            'empleado_documento': empleado_perfil.numero_documento,
            'empleado_cargo': laboral.cargo if laboral else '',
            'area_actual': laboral.area if laboral else 'N/A',
            'carpeta_actual': laboral.carpeta if laboral else 'N/A',
            'area_nueva': nueva_area,
            'carpeta_nueva': nueva_carpeta,
            'motivo': motivo or 'Reasignación de recursos operativos',
            'solicitante_nombre': solicitante_usuario.get_full_name() or solicitante_usuario.username if solicitante_usuario else 'Usuario',
            'solicitante_cargo': solicitante_lab.cargo if solicitante_lab else 'Líder de Área',
            'solicitante_area': solicitante_lab.area if solicitante_lab else '',
            'fecha_solicitud': today_str,
            'app_url': app_url,
        }

        asunto = f"SOLICITUD ACTUALIZACIÓN ÁREA - CARPETA - {empleado_perfil.nombre_completo}"
        plantilla = 'emails/notificacion_traslado.html'

        return cls.encolar(
            evento='SOLICITUD_TRASLADO',
            idempotency_key=idempotency_key,
            destinatarios=destinatarios,
            asunto=asunto,
            plantilla=plantilla,
            contexto=contexto,
            ejecutar_inmediato=True
        )

    @classmethod
    def encolar_alerta_periodo_prueba(
        cls,
        empleados_criticos_ids: list[int] | None = None,
        usuario_operador = None,
        forzar: bool = False
    ) -> tuple[NotificacionCorreo | None, int, bool]:
        """
        Encola la alerta institucional consolidada de colaboradores en período de prueba crítico (<= 15 días).
        Agrupa y notifica a Gestión Humana, Programación y supervisores directos.
        Retorna (registro, total_colaboradores, creado).
        """
        import calendar
        from datetime import date
        from apps.empleados.models import EmpleadoPerfil

        hoy = timezone.now().date()
        today_str = hoy.strftime('%Y-%m-%d')

        qs = EmpleadoPerfil.objects.filter(
            estado='ACTIVO',
            laboral__fecha_ingreso__isnull=False
        ).select_related('laboral', 'laboral__supervisor', 'laboral__supervisor__contacto')

        if empleados_criticos_ids:
            qs = qs.filter(id__in=empleados_criticos_ids)

        colaboradores = []
        supervisores_emails = set()

        for emp in qs:
            lab = getattr(emp, 'laboral', None)
            if not lab or not lab.fecha_ingreso:
                continue

            dias = lab.dias_para_periodo_prueba
            if dias is None or dias > 15 or dias < 0:
                continue

            try:
                y = lab.fecha_ingreso.year + (lab.fecha_ingreso.month + 2 - 1) // 12
                m = (lab.fecha_ingreso.month + 2 - 1) % 12 + 1
                max_d = calendar.monthrange(y, m)[1]
                d = min(lab.fecha_ingreso.day, max_d)
                limite_str = date(y, m, d).strftime('%Y-%m-%d')
            except Exception:
                limite_str = str(lab.fecha_ingreso)

            doc = emp.numero_documento or ''
            doc_ofuscado = f"CC ****{doc[-4:]}" if len(doc) > 4 else f"CC {doc}"

            sup = getattr(lab, 'supervisor', None)
            sup_nombre = sup.nombre_completo if sup else ''
            sup_contacto = getattr(sup, 'contacto', None) if sup else None
            sup_correo = (sup_contacto.correo_corporativo or '').strip() if sup_contacto else ''
            if sup_correo and '@' in sup_correo:
                supervisores_emails.add(sup_correo)

            colaboradores.append({
                'id': emp.id,
                'nombre_completo': emp.nombre_completo,
                'documento_ofuscado': doc_ofuscado,
                'cargo': lab.cargo or 'Sin cargo',
                'area': lab.area or '',
                'carpeta': lab.carpeta or '',
                'fecha_ingreso': str(lab.fecha_ingreso),
                'fecha_limite_prueba': limite_str,
                'dias_restantes': dias,
                'supervisor_nombre': sup_nombre,
                'supervisor_correo': sup_correo,
                'es_critico': dias <= 7,
                'es_advertencia': 7 < dias <= 15,
            })

        total = len(colaboradores)
        if total == 0:
            return None, 0, False

        colaboradores.sort(key=lambda x: x['dias_restantes'])

        destinatarios_set = set(getattr(settings, 'NOTIFICACION_PERIODOS_PRUEBA_TO', []))
        destinatarios_set.update(supervisores_emails)
        destinatarios = sorted(list(destinatarios_set))

        idempotency_key = f"alerta:periodo_prueba:{today_str}"
        if forzar:
            import uuid
            idempotency_key = f"alerta:periodo_prueba:{today_str}:{uuid.uuid4().hex[:6]}"

        contexto = {
            'total_colaboradores': total,
            'colaboradores': colaboradores,
            'fecha_generacion': timezone.now().strftime('%Y-%m-%d %H:%M'),
            'usuario_operador': usuario_operador.get_full_name() or usuario_operador.username if usuario_operador else 'Sistema',
            'app_url': 'http://localhost:3000' if settings.DEBUG else 'https://frontend.cincosas.com',
        }

        asunto = f"ALERTA DE TALENTO: Vencimiento de Período de Prueba ({total} Colaborador{'es' if total != 1 else ''}) - CINCO SAS"
        plantilla = 'emails/notificacion_alerta_periodo_prueba.html'

        registro_existente = NotificacionCorreo.objects.filter(idempotency_key=idempotency_key).first()
        creado = registro_existente is None

        registro = cls.encolar(
            evento='ALERTA_PERIODO_PRUEBA',
            idempotency_key=idempotency_key,
            destinatarios=destinatarios,
            asunto=asunto,
            plantilla=plantilla,
            contexto=contexto,
            ejecutar_inmediato=True
        )

        return registro, total, creado

    @classmethod
    def encolar_alerta_practicas(
        cls,
        aprendices_criticos_ids: list[int] | None = None,
        usuario_operador = None,
        forzar: bool = False
    ) -> tuple[NotificacionCorreo | None, int, bool]:
        """
        Encola la alerta institucional consolidada de aprendices SENA con etapa lectiva o productiva
        próxima a vencer (<= 15 días o vencida).
        Notifica a Gestión Humana, Programación y supervisores.
        Retorna (registro, total_aprendices, creado).
        """
        from apps.empleados.models import EmpleadoPerfil

        hoy = timezone.now().date()
        today_str = hoy.strftime('%Y-%m-%d')

        qs = EmpleadoPerfil.objects.filter(
            estado='ACTIVO'
        ).select_related('laboral', 'laboral__supervisor', 'laboral__supervisor__contacto')

        if aprendices_criticos_ids:
            qs = qs.filter(id__in=aprendices_criticos_ids)

        aprendices = []
        supervisores_emails = set()

        for emp in qs:
            lab = getattr(emp, 'laboral', None)
            if not lab or not lab.en_practicas:
                continue

            dias = lab.dias_para_fin_practica
            if dias is None or dias > 15:
                continue

            etapa = lab.etapa_practica_activa or 'PRACTICAS'
            fin_fecha = lab.fecha_fin_practica_actual

            doc = emp.numero_documento or ''
            doc_ofuscado = f"CC ****{doc[-4:]}" if len(doc) > 4 else f"CC {doc}"

            sup = getattr(lab, 'supervisor', None)
            sup_nombre = sup.nombre_completo if sup else ''
            sup_contacto = getattr(sup, 'contacto', None) if sup else None
            sup_correo = (sup_contacto.correo_corporativo or '').strip() if sup_contacto else ''
            if sup_correo and '@' in sup_correo:
                supervisores_emails.add(sup_correo)

            aprendices.append({
                'id': emp.id,
                'nombre_completo': emp.nombre_completo,
                'documento_ofuscado': doc_ofuscado,
                'cargo': lab.cargo or 'Aprendiz SENA',
                'area': lab.area or '',
                'carpeta': lab.carpeta or '',
                'etapa_nombre': etapa.capitalize(),
                'es_lectiva': etapa.upper() == 'LECTIVA',
                'fecha_fin': str(fin_fecha) if fin_fecha else 'Por definir',
                'dias_restantes': dias,
                'supervisor_nombre': sup_nombre,
                'supervisor_correo': sup_correo,
                'es_critico': dias <= 7,
                'es_advertencia': 7 < dias <= 15,
            })

        total = len(aprendices)
        if total == 0:
            return None, 0, False

        aprendices.sort(key=lambda x: x['dias_restantes'])

        destinatarios_set = set(getattr(settings, 'NOTIFICACION_PRACTICAS_SENA_TO', []))
        destinatarios_set.update(supervisores_emails)
        destinatarios = sorted(list(destinatarios_set))

        idempotency_key = f"alerta:practicas_sena:{today_str}"
        if forzar:
            import uuid
            idempotency_key = f"alerta:practicas_sena:{today_str}:{uuid.uuid4().hex[:6]}"

        contexto = {
            'total_aprendices': total,
            'aprendices': aprendices,
            'fecha_generacion': timezone.now().strftime('%Y-%m-%d %H:%M'),
            'usuario_operador': usuario_operador.get_full_name() or usuario_operador.username if usuario_operador else 'Sistema',
            'app_url': 'http://localhost:3000' if settings.DEBUG else 'https://frontend.cincosas.com',
        }

        asunto = f"ALERTA DE APRENDICES: Vencimiento de Etapa SENA ({total} Aprendiz{'es' if total != 1 else ''}) - CINCO SAS"
        plantilla = 'emails/notificacion_alerta_practicas.html'

        registro_existente = NotificacionCorreo.objects.filter(idempotency_key=idempotency_key).first()
        creado = registro_existente is None

        registro = cls.encolar(
            evento='ALERTA_PRACTICAS_SENA',
            idempotency_key=idempotency_key,
            destinatarios=destinatarios,
            asunto=asunto,
            plantilla=plantilla,
            contexto=contexto,
            ejecutar_inmediato=True
        )

        return registro, total, creado


