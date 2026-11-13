import re
import logging
import calendar
from datetime import timedelta, date
from django.db import transaction, connection, connections
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from apps.empleados.models import (
    EmpleadoPerfil,
    EmpleadoLaboral,
    EmpleadoContacto,
    EmpleadoSeguridadSocial,
    EmpleadoCertificacionesSST,
    EmpleadoDotacionActivos,
    EmpleadoDotacionComprobante,
    EmpleadoMovilidad,
    EmpleadoCuentaBancaria,
    EmpleadoAuditoriaLog,
)

logger = logging.getLogger(__name__)

User = get_user_model()


class EmpleadoWorkflowService:
    """
    Capa de servicio y lógica de dominio para la gestión del ciclo de vida
    del empleado, cuadrillas, flota, inducción y auditoría.
    """

    @staticmethod
    def validar_fecha_ingreso(fecha_ingreso):
        """
        Regla Legacy PHP: esFechaIngresoMayorAHoy() (Líneas 62-78 de infraestructura_cinco_sas.php)
        La fecha de ingreso no puede ser superior a 5 días posteriores a la fecha actual.
        """
        if not fecha_ingreso:
            return
        if isinstance(fecha_ingreso, str):
            try:
                from datetime import datetime
                fecha_ingreso = datetime.strptime(fecha_ingreso[:10], '%Y-%m-%d').date()
            except Exception:
                pass
        fecha_limite = timezone.now().date() + timedelta(days=5)
        if fecha_ingreso > fecha_limite:
            raise ValidationError(
                "La fecha de ingreso no puede ser mayor a 5 días posteriores a hoy."
            )

    @staticmethod
    def calcular_seis_meses_despues(fecha):
        """
        Regla Legacy PHP: calcularSeisMesesDespues() (Líneas 7600-7619 de infraestructura_cinco_sas.php)
        Calcula la fecha de finalización sumando exactamente 6 meses a la fecha inicial,
        respetando el ajuste al último día del mes cuando el mes destino tiene menos días.
        """
        if not fecha:
            return None
        if isinstance(fecha, str):
            try:
                from datetime import datetime
                fecha = datetime.strptime(str(fecha)[:10], '%Y-%m-%d').date()
            except Exception:
                return None

        import calendar
        from datetime import date
        year = fecha.year
        month = fecha.month + 6
        if month > 12:
            year += 1
            month -= 12
        max_days = calendar.monthrange(year, month)[1]
        day = min(fecha.day, max_days)
        return date(year, month, day)

    @staticmethod
    def normalizar_numero_cuenta(nro: str) -> str:
        """
        Regla Legacy PHP: normalizeCuenta() (Líneas 283-296 de infraestructura_cinco_sas.php)
        Limpia caracteres no numéricos y antepone ceros hasta completar 12 dígitos.
        """
        if not nro:
            return ""
        limpio = re.sub(r'\D', '', str(nro))
        return limpio.zfill(12)

    @staticmethod
    def validar_integridad_cedula(numero_documento: str):
        """
        Regla Legacy PHP: update_cedula (Líneas 1905-2008 de infraestructura_cinco_sas.php)
        Impide modificar la cédula si existen registros en Agenda de Trabajos,
        Ausentismos, Viáticos o movimientos de Logística.
        """
        with connection.cursor() as cursor:
            # 1. Agenda de Trabajos
            cursor.execute(
                "SELECT 1 FROM agenda_trabajos_cinco WHERE cedula = %s LIMIT 1",
                [numero_documento]
            )
            if cursor.fetchone():
                raise ValidationError(
                    "La cédula no puede modificarse porque está asociada a movimientos en Agenda de Trabajos."
                )

            # 2. Ausentismos en Gestión Humana
            cursor.execute(
                "SELECT 1 FROM gestionh_ausentismo WHERE cedula = %s LIMIT 1",
                [numero_documento]
            )
            if cursor.fetchone():
                raise ValidationError(
                    "La cédula no puede modificarse porque está asociada a registros en Gestión Humana (Ausentismos)."
                )

            # 3. Viáticos
            cursor.execute(
                "SELECT 1 FROM viaticos_solicitud WHERE responsable = %s LIMIT 1",
                [numero_documento]
            )
            if cursor.fetchone():
                raise ValidationError(
                    "La cédula no puede modificarse porque está asociada a solicitudes de Viáticos."
                )

    @staticmethod
    def registrar_auditoria(
        empleado: EmpleadoPerfil,
        usuario: User,
        accion: str,
        tabla_afectada: str,
        datos_anteriores: dict = None,
        datos_nuevos: dict = None,
        ip_origen: str = None
    ) -> EmpleadoAuditoriaLog:
        """
        Registra una traza de auditoría transaccional en empleados_auditoria_log.
        Fallback al usuario del perfil si no se provee operador explícito.
        """
        user_to_log = usuario or getattr(empleado, 'user', None)
        if not user_to_log:
            return None
        return EmpleadoAuditoriaLog.objects.create(
            empleado=empleado,
            usuario=user_to_log,
            accion=accion,
            tabla_afectada=tabla_afectada,
            datos_anteriores=datos_anteriores,
            datos_nuevos=datos_nuevos,
            ip_origen=ip_origen
        )

    @classmethod
    @transaction.atomic
    def crear_empleado(cls, data: dict, user_creator: User, ip_address: str = None) -> EmpleadoPerfil:
        """
        Crea un nuevo colaborador:
        1. Aprovisiona obligatoriamente la cuenta de usuario en auth_user.
        2. Crea EmpleadoPerfil.
        3. Crea EmpleadoLaboral en estado inicial 'EN_FORMACION' (Gestión Humana).
        4. Crea entidades satélites si se proveen datos iniciales.
        5. Registra la auditoría inicial de creación.
        """
        doc = str(data.get('numero_documento', '')).strip()
        if not doc:
            raise ValidationError("El número de documento es obligatorio.")

        if EmpleadoPerfil.objects.filter(numero_documento=doc).exists():
            raise ValidationError(f"Ya existe un empleado con el documento {doc}.")

        laboral_data = data.get('laboral', {})
        fecha_ingreso = laboral_data.get('fecha_ingreso')
        if not fecha_ingreso:
            raise ValidationError("La fecha de ingreso laboral es obligatoria.")
        cls.validar_fecha_ingreso(fecha_ingreso)

        # 1. Aprovisionamiento en auth_user
        user, created = User.objects.get_or_create(
            username=doc,
            defaults={
                'first_name': data.get('nombres', '')[:30].strip().upper(),
                'last_name': data.get('apellidos', '')[:30].strip().upper(),
                'email': data.get('contacto', {}).get('correo_corporativo', '') or '',
                'is_active': True,
            }
        )
        if created:
            user.set_password(doc)
            user.save()

        # 2. Extraer y normalizar nombres/apellidos
        nombres = (data.get('nombres') or f"{data.get('primer_nombre', '')} {data.get('segundo_nombre', '')}").strip().upper()
        apellidos = (data.get('apellidos') or f"{data.get('primer_apellido', '')} {data.get('segundo_apellido', '')}").strip().upper()
        if not nombres:
            raise ValidationError("Los nombres del colaborador son obligatorios.")
        if not apellidos:
            raise ValidationError("Los apellidos del colaborador son obligatorios.")

        if isinstance(fecha_ingreso, str):
            try:
                from datetime import datetime
                fecha_ingreso = datetime.strptime(fecha_ingreso[:10], '%Y-%m-%d').date()
            except Exception:
                pass

        # 2. Perfil
        perfil = EmpleadoPerfil.objects.create(
            user=user,
            tipo_documento=data.get('tipo_documento', 'CC'),
            numero_documento=doc,
            fecha_expedicion_documento=data.get('fecha_expedicion_documento'),
            pasaporte=data.get('pasaporte'),
            nombres=nombres,
            apellidos=apellidos,
            fecha_nacimiento=data.get('fecha_nacimiento'),
            genero=data.get('genero'),
            estado_civil=data.get('estado_civil'),
            foto_url=data.get('foto_url', 'photos/Default.png'),
            estado='ACTIVO',
            datos_adicionales=data.get('datos_adicionales'),
        )

        # 3. Laboral en etapa de formación (con cálculo automático de 6 meses para etapas SENA - Regla 2.8)
        p_lect_inicio = laboral_data.get('practica_lectiva_inicio')
        p_lect_fin = laboral_data.get('practica_lectiva_fin')
        if p_lect_inicio and not p_lect_fin:
            p_lect_fin = cls.calcular_seis_meses_despues(p_lect_inicio)

        p_prod_inicio = laboral_data.get('practica_productiva_inicio')
        p_prod_fin = laboral_data.get('practica_productiva_fin')
        if p_prod_inicio and not p_prod_fin:
            p_prod_fin = cls.calcular_seis_meses_despues(p_prod_inicio)

        lab_creado = EmpleadoLaboral.objects.create(
            empleado=perfil,
            codigo_sap=laboral_data.get('codigo_sap'),
            sede=laboral_data.get('sede') or laboral_data.get('ciudad_operacion') or 'CALI',
            area=laboral_data.get('area', 'GESTION HUMANA'),
            carpeta=laboral_data.get('carpeta', 'FORMACION'),
            puesto=laboral_data.get('puesto'),
            movil=laboral_data.get('movil', '1 - SIN ASIGNAR'),
            cargo=laboral_data.get('cargo', 'EN FORMACION'),
            funcion_cargo=laboral_data.get('funcion_cargo'),
            tipo_labor=laboral_data.get('tipo_labor', 'OPERATIVO'),
            zona_nodo=laboral_data.get('zona_nodo'),
            supervisor_id=laboral_data.get('supervisor_id'),
            padrino_id=laboral_data.get('padrino_id'),
            formador=laboral_data.get('formador'),
            grupo_comisiones=laboral_data.get('grupo_comisiones'),
            nivel_estudio=laboral_data.get('nivel_estudio'),
            fecha_ingreso=fecha_ingreso,
            etapa_induccion='EN_FORMACION',
            practica_lectiva_inicio=p_lect_inicio,
            practica_lectiva_fin=p_lect_fin,
            practica_productiva_inicio=p_prod_inicio,
            practica_productiva_fin=p_prod_fin,
        )

        # 4. Satélites iniciales opcionales
        contacto_data = data.get('contacto', {})
        EmpleadoContacto.objects.create(
            empleado=perfil,
            correo_corporativo=contacto_data.get('correo_corporativo'),
            correo_personal=contacto_data.get('correo_personal'),
            celular_corporativo=contacto_data.get('celular_corporativo'),
            celular_personal=contacto_data.get('celular_personal'),
            celular_alterno=contacto_data.get('celular_alterno'),
            telefono_fijo=contacto_data.get('telefono_fijo'),
            direccion_residencia=contacto_data.get('direccion_residencia'),
            claro_pay=contacto_data.get('claro_pay'),
        )

        movilidad_data = data.get('movilidad', {})
        EmpleadoMovilidad.objects.create(
            empleado=perfil,
            sabe_conducir=movilidad_data.get('sabe_conducir', False),
            medio_transporte=movilidad_data.get('medio_transporte'),
            modelo_vehiculo=movilidad_data.get('modelo_vehiculo'),
            placa_vehiculo=movilidad_data.get('placa_vehiculo'),
        )

        ss_data = data.get('seguridad_social', {})
        EmpleadoSeguridadSocial.objects.create(
            empleado=perfil,
            eps=ss_data.get('eps'),
            arl=ss_data.get('arl') or 'COLMENA',
            afp=ss_data.get('afp'),
            certificado_arl_url=ss_data.get('certificado_arl_url'),
            esquema_vacunacion=ss_data.get('esquema_vacunacion'),
        )

        dot_data = data.get('dotacion_activos', {})
        EmpleadoDotacionActivos.objects.create(
            empleado=perfil,
            tiene_carnet=dot_data.get('tiene_carnet', False),
            fecha_entrega_carnet=dot_data.get('fecha_entrega_carnet'),
            talla_camisa=dot_data.get('talla_camisa'),
            talla_pantalon=dot_data.get('talla_pantalon'),
            talla_calzado=dot_data.get('talla_calzado'),
            talla_chaqueta=dot_data.get('talla_chaqueta'),
            talla_guerrera=dot_data.get('talla_guerrera'),
        )

        sst_data = data.get('certificaciones_sst', {})
        EmpleadoCertificacionesSST.objects.create(
            empleado=perfil,
            permiso_trabajo=sst_data.get('permiso_trabajo'),
            certificado_alturas_url=sst_data.get('certificado_alturas_url'),
            vencimiento_alturas=sst_data.get('vencimiento_alturas'),
            certificado_tecnico_url=sst_data.get('certificado_tecnico_url'),
            vencimiento_tecnico=sst_data.get('vencimiento_tecnico'),
        )

        # 5. Auditoría
        cls.registrar_auditoria(
            empleado=perfil,
            usuario=user_creator,
            accion='CREACION',
            tabla_afectada='empleados_perfil',
            datos_nuevos={
                'numero_documento': doc,
                'nombre_completo': perfil.nombre_completo,
                'fecha_ingreso': str(fecha_ingreso),
            },
            ip_origen=ip_address
        )


        # 6. Auto-herencia de cuadrilla si se crea como auxiliar asignado a cuadrilla operativa (Regla Legacy 2.6)
        if (
            'AUXILIAR' in (lab_creado.cargo or '').upper()
            and lab_creado.movil
            and 'ASIGNAR' not in lab_creado.movil.upper()
        ):
            cls.sincronizar_herencia_auxiliar_desde_tecnico(
                auxiliar_perfil=perfil,
                user_operator=user_creator,
                ip_address=ip_address
            )
        return perfil

    @classmethod
    @transaction.atomic
    def entregar_empleado_gh(
        cls,
        empleado_id: int,
        supervisor_recibe_id: int,
        user_operator: User,
        ip_address: str = None
    ) -> EmpleadoLaboral:
        """
        Procedimiento Operativo: Entrega de Personal de GH (Sección 6 del Doc)
        Equivale a la acción legacy entregar_empleado (Líneas 546-621).
        Transiciona etapa_induccion de EN_FORMACION a ENTREGADO, asignando
        el área, carpeta y supervisor del receptor.
        """
        perfil = EmpleadoPerfil.objects.select_for_update().get(id=empleado_id)
        laboral = perfil.laboral
        supervisor_recibe = EmpleadoPerfil.objects.get(id=supervisor_recibe_id)
        laboral_sup = supervisor_recibe.laboral

        datos_antes = {
            'area': laboral.area,
            'carpeta': laboral.carpeta,
            'supervisor_id': laboral.supervisor_id,
            'etapa_induccion': laboral.etapa_induccion,
        }

        # Transición
        laboral.area = laboral_sup.area
        laboral.carpeta = laboral_sup.carpeta
        laboral.supervisor = supervisor_recibe
        laboral.etapa_induccion = 'ENTREGADO'
        laboral.fecha_entrega_area = timezone.now().date()
        if hasattr(user_operator, 'empleado_perfil'):
            laboral.entregado_por = user_operator.empleado_perfil
        laboral.save()

        datos_nuevos = {
            'area': laboral.area,
            'carpeta': laboral.carpeta,
            'supervisor_id': supervisor_recibe.id,
            'etapa_induccion': 'ENTREGADO',
            'fecha_entrega_area': str(laboral.fecha_entrega_area),
        }

        cls.registrar_auditoria(
            empleado=perfil,
            usuario=user_operator,
            accion='ENTREGA_AREA',
            tabla_afectada='empleados_laboral',
            datos_anteriores=datos_antes,
            datos_nuevos=datos_nuevos,
            ip_origen=ip_address
        )

        return laboral

    @classmethod
    @transaction.atomic
    def asignar_placa_vehiculo(
        cls,
        empleado_id: int,
        placa: str,
        conduce: bool = False,
        medio_transporte: str = 'NINGUNO',
        modelo_vehiculo: str = '',
        user_operator: User = None,
        ip_address: str = None
    ) -> EmpleadoMovilidad:
        """
        Equivale a la acción legacy editar_placa (Líneas 1051-1135 de infraestructura_cinco_sas.php).
        1. Garantiza exclusividad de placa: si otro empleado la tiene asignada, se le retira.
        2. Asigna la placa al empleado objetivo.
        3. Registra auditoría.
        """
        perfil = EmpleadoPerfil.objects.select_for_update().get(id=empleado_id)
        movilidad, _ = EmpleadoMovilidad.objects.get_or_create(empleado=perfil)
        placa = placa.strip().upper() if placa else None

        if placa:
            # 1. Regla de exclusividad atómica: desasignar de quien la tuviera
            otros_con_placa = EmpleadoMovilidad.objects.filter(placa_vehiculo=placa).exclude(empleado_id=empleado_id)
            for otro in otros_con_placa:
                otro_perfil = otro.empleado
                otro.placa_vehiculo = None
                otro.save()
                if user_operator:
                    cls.registrar_auditoria(
                        empleado=otro_perfil,
                        usuario=user_operator,
                        accion='LIBERACION_PLACA',
                        tabla_afectada='empleados_movilidad',
                        datos_anteriores={'placa_vehiculo': placa},
                        datos_nuevos={'placa_vehiculo': None},
                        ip_origen=ip_address
                    )

        datos_antes = {
            'placa_vehiculo': movilidad.placa_vehiculo,
            'sabe_conducir': movilidad.sabe_conducir,
            'medio_transporte': movilidad.medio_transporte,
            'modelo_vehiculo': movilidad.modelo_vehiculo,
        }

        movilidad.placa_vehiculo = placa
        movilidad.sabe_conducir = conduce
        movilidad.medio_transporte = medio_transporte
        movilidad.modelo_vehiculo = modelo_vehiculo
        movilidad.save()

        datos_nuevos = {
            'placa_vehiculo': placa,
            'sabe_conducir': conduce,
            'medio_transporte': medio_transporte,
            'modelo_vehiculo': modelo_vehiculo,
        }

        if user_operator:
            cls.registrar_auditoria(
                empleado=perfil,
                usuario=user_operator,
                accion='ASIGNAR_PLACA',
                tabla_afectada='empleados_movilidad',
                datos_anteriores=datos_antes,
                datos_nuevos=datos_nuevos,
                ip_origen=ip_address
            )

        # Sincronización cruzada con la base de datos Legacy 'azul' (Punto 2.3)
        placa_ant = datos_antes.get('placa_vehiculo')
        sync_result = cls.sincronizar_placa_legacy_transporte(
            empleado_perfil=perfil,
            nueva_placa=placa,
            conduce=conduce,
            medio_transporte=medio_transporte,
            placa_anterior=placa_ant,
            user_operator=user_operator
        )
        setattr(movilidad, '_sync_legacy_transporte', sync_result)

        return movilidad

    @classmethod
    def sincronizar_placa_legacy_transporte(
        cls,
        empleado_perfil: EmpleadoPerfil,
        nueva_placa: str | None,
        conduce: bool | str = False,
        medio_transporte: str = 'NINGUNO',
        placa_anterior: str | None = None,
        user_operator: User = None
    ) -> dict:
        """
        Sincronización cruzada con la base de datos Legacy 'azul' (Punto 2.3):
        Replica fielmente la lógica de 'editar_placa' y 'actualizarMovilRegistroSalida'
        (líneas 214-270 y 1328-1420 de infraestructura_cinco_sas.php):
        1. Desasigna en cinco_base_de_personal y transportadores_vehiculos si la placa previa cambió.
        2. Actualiza cinco_base_de_personal con la nueva placa, conductor y datos JSON (conduce, transporte).
        3. Actualiza transportadores_vehiculos (cedual_conductor = cedula, edit, fecha_edit).
        4. Sincroniza transporte_registro_salida si el vehículo tiene modalidad 'pago_mensual'
           para el mes actual y la cantidad de despachos generados coincide con los días del mes.
        """
        resultado = {
            'placa_actualizada': False,
            'vehiculo_actualizado': False,
            'salidas_actualizadas': 0,
            'pago_mensual_aplica': False,
            'errores': []
        }

        cedula = str(empleado_perfil.numero_documento or '').strip()
        if not cedula:
            resultado['errores'].append("El empleado no posee número de documento.")
            return resultado

        edit_user = str(user_operator.username if user_operator else 'SISTEMA').strip()
        placa_clean = nueva_placa.strip().upper() if nueva_placa else ''
        placa_ant_clean = placa_anterior.strip().upper() if placa_anterior else ''

        conduce_val = 'SI' if (conduce is True or str(conduce).strip().upper() in ('SI', '1', 'TRUE')) else 'NO'
        transporte_val = str(medio_transporte or 'NINGUNO').strip().upper()

        laboral = getattr(empleado_perfil, 'laboral', None)
        if not laboral:
            laboral = EmpleadoLaboral.objects.filter(empleado=empleado_perfil).first()
        area = str(laboral.area or '').strip() if laboral else ''
        carpeta = str(laboral.carpeta or '').strip() if laboral else ''

        try:
            conn_azul = connections['azul']
            with transaction.atomic(using='azul'):
                with conn_azul.cursor() as cursor:
                    # 1. Liberar placa previa si cambió y existía
                    if placa_ant_clean and placa_ant_clean != placa_clean:
                        cursor.execute(
                            """
                            UPDATE transportadores_vehiculos 
                            SET cedual_conductor = '', edit = %s, fecha_edit = NOW() 
                            WHERE placa = %s AND cedual_conductor = %s
                            """,
                            [edit_user, placa_ant_clean, cedula]
                        )
                        cursor.execute(
                            "UPDATE cinco_base_de_personal SET placa = '' WHERE placa = %s AND cedula = %s",
                            [placa_ant_clean, cedula]
                        )

                    if placa_clean:
                        # 2. Desasignar placa en cinco_base_de_personal (regla de exclusividad en legacy)
                        cursor.execute(
                            "UPDATE cinco_base_de_personal SET placa = '' WHERE placa = %s",
                            [placa_clean]
                        )

                        # 3. Actualizar cinco_base_de_personal para el colaborador
                        cursor.execute(
                            """
                            UPDATE cinco_base_de_personal 
                            SET 
                                placa = %s, 
                                edit = %s, 
                                fecha_edit = NOW(),
                                datos = JSON_SET(
                                    COALESCE(datos, '{}'), 
                                    '$.conduce', %s, 
                                    '$.transporte', %s
                                ) 
                            WHERE cedula = %s
                            """,
                            [placa_clean, edit_user, conduce_val, transporte_val, cedula]
                        )
                        resultado['placa_actualizada'] = True

                        # 4. Actualizar transportadores_vehiculos
                        cursor.execute(
                            """
                            UPDATE transportadores_vehiculos 
                            SET cedual_conductor = %s, edit = %s, fecha_edit = NOW() 
                            WHERE placa = %s
                            """,
                            [cedula, edit_user, placa_clean]
                        )
                        resultado['vehiculo_actualizado'] = (cursor.rowcount > 0)

                        # 5. Regla de Registros de Salida (actualizarMovilRegistroSalida)
                        hoy = timezone.localdate() if timezone.is_aware(timezone.now()) else date.today()
                        mes_str = f"{hoy.month:02d}"
                        _, ultimo_dia = calendar.monthrange(hoy.year, hoy.month)
                        fecha_inicio = date(hoy.year, hoy.month, 1)
                        fecha_fin = date(hoy.year, hoy.month, ultimo_dia)
                        total_dias_mes = (fecha_fin - fecha_inicio).days + 1

                        # Validar si el vehículo tiene modalidad pago mensual para el mes actual
                        cursor.execute(
                            """
                            SELECT id, placa, valor_dia 
                            FROM transportadores_vehiculos 
                            WHERE JSON_CONTAINS(JSON_EXTRACT(datos, '$.pago_mensual[*].mes'), %s) 
                            AND placa = %s 
                            LIMIT 1
                            """,
                            [f'"{mes_str}"', placa_clean]
                        )
                        vehiculo_mensual = cursor.fetchone()

                        if vehiculo_mensual:
                            resultado['pago_mensual_aplica'] = True

                            # Consultar registros de salida generados para el vehículo en el mes
                            cursor.execute(
                                """
                                SELECT COUNT(*) 
                                FROM transporte_registro_salida 
                                WHERE JSON_EXTRACT(datos, '$.placa') = %s 
                                AND DATE(fecha_salida) BETWEEN %s AND %s
                                """,
                                [placa_clean, fecha_inicio, fecha_fin]
                            )
                            cnt_row = cursor.fetchone()
                            total_registros_salida = cnt_row[0] if cnt_row else 0

                            # Si coincide la cantidad total de días del mes, actualizar registros de salida
                            if total_registros_salida == total_dias_mes:
                                cursor.execute(
                                    """
                                    UPDATE transporte_registro_salida AS trs
                                    SET
                                        trs.movil_sale = %s,
                                        trs.cedula_tecnico = %s,
                                        trs.edit = %s,
                                        trs.fecha_edit = NOW(),
                                        trs.datos = JSON_SET(
                                            trs.datos,
                                            '$.cc_sale', %s,
                                            '$.movil_sale', %s,
                                            '$.fecha_sale', DATE(trs.fecha_salida),
                                            '$.movil_asignada', %s,
                                            '$.cc_asignada', %s,
                                            '$.area_sale', %s,
                                            '$.carpeta_sale', %s
                                        )
                                    WHERE JSON_EXTRACT(trs.datos, '$.placa') = %s
                                    AND DATE(trs.fecha_salida) BETWEEN %s AND %s
                                    """,
                                    [
                                        cedula,
                                        cedula,
                                        edit_user,
                                        cedula,
                                        cedula,
                                        cedula,
                                        cedula,
                                        area,
                                        carpeta,
                                        placa_clean,
                                        fecha_inicio,
                                        fecha_fin
                                    ]
                                )
                                resultado['salidas_actualizadas'] = cursor.rowcount
                    else:
                        # Desasignación de placa: limpiar cinco_base_de_personal
                        cursor.execute(
                            """
                            UPDATE cinco_base_de_personal 
                            SET placa = '', edit = %s, fecha_edit = NOW() 
                            WHERE cedula = %s
                            """,
                            [edit_user, cedula]
                        )
                        resultado['placa_actualizada'] = True

        except Exception as e:
            err_msg = f"Error en sincronización cruzada de transporte azul: {e}"
            logger.warning(err_msg)
            resultado['errores'].append(err_msg)

        return resultado

    @classmethod
    @transaction.atomic
    def sincronizar_herencia_auxiliar_desde_tecnico(
        cls,
        auxiliar_perfil: EmpleadoPerfil,
        user_operator: User = None,
        ip_address: str = None
    ) -> dict:
        """
        Replica la regla legacy de auto-herencia de cuadrilla para auxiliares
        (Líneas 3139-3151 de infraestructura_cinco_sas.php):
        Cuando un AUXILIAR se asigna a un móvil operativo que no contiene 'SIN ASIGNAR',
        se busca el TÉCNICO activo de ese móvil y se copian automáticamente:
        - supervisor
        - área
        - carpeta
        - medio_transporte (desde EmpleadoMovilidad)
        """
        lab_aux = EmpleadoLaboral.objects.filter(empleado=auxiliar_perfil).first()
        if not lab_aux or 'AUXILIAR' not in (lab_aux.cargo or '').upper():
            return {'heredado': False}

        movil_actual = (lab_aux.movil or '').strip()
        if not movil_actual or 'ASIGNAR' in movil_actual.upper() or 'FUERA DE OPERACION' in movil_actual.upper():
            return {'heredado': False}

        # Buscar técnico activo en la misma cuadrilla/móvil
        tecnico_lab = EmpleadoLaboral.objects.filter(
            movil=movil_actual,
            cargo__icontains='TECNICO',
            empleado__estado='ACTIVO'
        ).exclude(empleado=auxiliar_perfil).select_related('supervisor', 'empleado', 'empleado__movilidad').first()

        if not tecnico_lab:
            return {'heredado': False}

        cambios_lab = {}
        lab_antes = {
            'supervisor_id': lab_aux.supervisor_id,
            'area': lab_aux.area,
            'carpeta': lab_aux.carpeta,
        }

        if lab_aux.supervisor_id != tecnico_lab.supervisor_id:
            lab_aux.supervisor = tecnico_lab.supervisor
            cambios_lab['supervisor'] = tecnico_lab.supervisor_id

        if lab_aux.area != tecnico_lab.area:
            lab_aux.area = tecnico_lab.area
            cambios_lab['area'] = tecnico_lab.area

        if lab_aux.carpeta != tecnico_lab.carpeta:
            lab_aux.carpeta = tecnico_lab.carpeta
            cambios_lab['carpeta'] = tecnico_lab.carpeta

        if cambios_lab:
            lab_aux.save(update_fields=list(cambios_lab.keys()))

        # Sincronizar medio_transporte si el técnico lo tiene asignado
        tec_mov = getattr(tecnico_lab.empleado, 'movilidad', None)
        cambios_mov = {}
        mov_antes = None
        if tec_mov and tec_mov.medio_transporte:
            aux_mov, _ = EmpleadoMovilidad.objects.get_or_create(empleado=auxiliar_perfil)
            if aux_mov.medio_transporte != tec_mov.medio_transporte:
                mov_antes = aux_mov.medio_transporte
                aux_mov.medio_transporte = tec_mov.medio_transporte
                aux_mov.save(update_fields=['medio_transporte'])
                cambios_mov['medio_transporte'] = tec_mov.medio_transporte

        # Auditoría si hubo cambios heredados
        if cambios_lab or cambios_mov:
            datos_ant = {**lab_antes}
            if mov_antes is not None:
                datos_ant['medio_transporte'] = mov_antes

            datos_nue = {
                'supervisor_id': lab_aux.supervisor_id,
                'area': lab_aux.area,
                'carpeta': lab_aux.carpeta,
                'tecnico_origen': tecnico_lab.empleado.nombre_completo,
            }
            if 'medio_transporte' in cambios_mov:
                datos_nue['medio_transporte'] = cambios_mov['medio_transporte']

            cls.registrar_auditoria(
                empleado=auxiliar_perfil,
                usuario=user_operator,
                accion='HERENCIA_CUADRILLA_AUXILIAR',
                tabla_afectada='empleados_laboral',
                datos_anteriores=datos_ant,
                datos_nuevos=datos_nue,
                ip_origen=ip_address
            )

        return {
            'heredado': True,
            'tecnico_nombre': tecnico_lab.empleado.nombre_completo,
            'supervisor_id': lab_aux.supervisor_id,
            'supervisor_nombre': lab_aux.supervisor.nombre_completo if lab_aux.supervisor else None,
            'area': lab_aux.area,
            'carpeta': lab_aux.carpeta,
            'medio_transporte': tec_mov.medio_transporte if tec_mov else None,
        }

    @classmethod
    @transaction.atomic
    def sincronizar_cuadrilla_tecnico_auxiliar(
        cls,
        tecnico_perfil: EmpleadoPerfil,
        nueva_movil: str,
        movil_anterior: str = None,
        user_operator: User = None,
        ip_address: str = None
    ):
        """
        Replica la regla legacy de cuadrillas (Líneas 3050-3158 de infraestructura_cinco_sas.php):
        - Si el técnico se actualiza en un móvil operativo válido (no 'SIN ASIGNAR'):
          Los auxiliares activos en ese móvil heredan supervisor, área, carpeta y transporte.
        - Si el técnico sale de su móvil anterior (cambio de móvil o desasignación) y NO
          quedan más técnicos activos en el móvil anterior:
          Los auxiliares en el móvil anterior se desvinculan a '1 - SIN ASIGNAR'.
        """
        laboral_tec = EmpleadoLaboral.objects.filter(empleado=tecnico_perfil).first()
        if not laboral_tec or 'TECNICO' not in (laboral_tec.cargo or '').upper():
            return

        nueva_movil_str = (nueva_movil or '').strip()
        movil_ant_str = (movil_anterior or '').strip()

        # 1. Si nueva_movil es operativa (no 'SIN ASIGNAR'), sincronizar auxiliares de esa cuadrilla
        if nueva_movil_str and "ASIGNAR" not in nueva_movil_str.upper() and "FUERA DE OPERACION" not in nueva_movil_str.upper():
            auxiliares = EmpleadoLaboral.objects.filter(
                movil=nueva_movil_str,
                cargo__icontains='AUXILIAR',
                empleado__estado='ACTIVO'
            ).exclude(empleado=tecnico_perfil)

            tec_mov = getattr(tecnico_perfil, 'movilidad', None)
            transporte_tec = tec_mov.medio_transporte if tec_mov else None

            for aux_lab in auxiliares:
                datos_antes = {
                    'supervisor_id': aux_lab.supervisor_id,
                    'area': aux_lab.area,
                    'carpeta': aux_lab.carpeta,
                }
                cambio = False
                if aux_lab.supervisor_id != laboral_tec.supervisor_id:
                    aux_lab.supervisor = laboral_tec.supervisor
                    cambio = True
                if aux_lab.area != laboral_tec.area:
                    aux_lab.area = laboral_tec.area
                    cambio = True
                if aux_lab.carpeta != laboral_tec.carpeta:
                    aux_lab.carpeta = laboral_tec.carpeta
                    cambio = True

                if cambio:
                    aux_lab.save(update_fields=['supervisor', 'area', 'carpeta'])

                # Sincronizar transporte en movilidad
                if transporte_tec:
                    aux_mov, _ = EmpleadoMovilidad.objects.get_or_create(empleado=aux_lab.empleado)
                    if aux_mov.medio_transporte != transporte_tec:
                        aux_mov.medio_transporte = transporte_tec
                        aux_mov.save(update_fields=['medio_transporte'])

                if cambio and user_operator:
                    cls.registrar_auditoria(
                        empleado=aux_lab.empleado,
                        usuario=user_operator,
                        accion='SINCRONIZACION_CUADRILLA',
                        tabla_afectada='empleados_laboral',
                        datos_anteriores=datos_antes,
                        datos_nuevos={
                            'supervisor_id': aux_lab.supervisor_id,
                            'area': aux_lab.area,
                            'carpeta': aux_lab.carpeta,
                            'tecnico': tecnico_perfil.nombre_completo,
                        },
                        ip_origen=ip_address
                    )

        # 2. Si el técnico dejó un móvil anterior que no sea 'SIN ASIGNAR'
        if movil_ant_str and movil_ant_str != nueva_movil_str and "ASIGNAR" not in movil_ant_str.upper() and "FUERA DE OPERACION" not in movil_ant_str.upper():
            quedan_tecnicos = EmpleadoLaboral.objects.filter(
                movil=movil_ant_str,
                cargo__icontains='TECNICO',
                empleado__estado='ACTIVO'
            ).exclude(empleado=tecnico_perfil).exists()

            if not quedan_tecnicos:
                auxiliares_huerfanos = EmpleadoLaboral.objects.filter(
                    movil=movil_ant_str,
                    cargo__icontains='AUXILIAR',
                    empleado__estado='ACTIVO'
                ).exclude(empleado=tecnico_perfil)

                for aux_lab in auxiliares_huerfanos:
                    aux_lab.movil = '1 - SIN ASIGNAR'
                    aux_lab.save(update_fields=['movil'])

                    if user_operator:
                        cls.registrar_auditoria(
                            empleado=aux_lab.empleado,
                            usuario=user_operator,
                            accion='DESVINCULACION_CUADRILLA',
                            tabla_afectada='empleados_laboral',
                            datos_anteriores={'movil': movil_ant_str},
                            datos_nuevos={'movil': '1 - SIN ASIGNAR'},
                            ip_origen=ip_address
                        )

    @classmethod
    @transaction.atomic
    def desactivar_empleado(
        cls,
        empleado_id: int,
        fecha_egreso,
        motivo: str,
        motivo_real: str = '',
        user_operator: User = None,
        ip_address: str = None
    ) -> EmpleadoPerfil:
        """
        Equivale a send_desactivar_empleado (Lineas 622-823 de infraestructura_cinco_sas.php).
        1. Estado a INACTIVO y revoca accesos en auth_user.
        2. Registra fecha de egreso, motivo y motivo real.
        3. Pasa movil a 'Z - FUERA DE OPERACION'.
        4. Libera la placa vehicular asignada.
        5. Regla de cuadrillas TIRAN: Si el tecnico retirado deja la cuadrilla sin ningun tecnico activo,
           todos los auxiliares y no-tecnicos activos en esa movil pasan automaticamente a '1 - SIN ASIGNAR'.
        """
        perfil = EmpleadoPerfil.objects.select_for_update().get(id=empleado_id)
        laboral = perfil.laboral
        movilidad, _ = EmpleadoMovilidad.objects.get_or_create(empleado=perfil)

        movil_antes = laboral.movil or ''

        datos_antes = {
            'estado': perfil.estado,
            'is_active': perfil.user.is_active,
            'movil': laboral.movil,
            'placa_vehiculo': movilidad.placa_vehiculo,
        }

        # 1. Desactivacion de cuenta e identidad
        perfil.estado = 'INACTIVO'
        perfil.user.is_active = False
        perfil.user.save()
        perfil.save()

        # 2. Desactivacion laboral
        laboral.fecha_egreso = fecha_egreso
        laboral.motivo_egreso = motivo
        laboral.motivo_egreso_real = motivo_real
        laboral.movil = 'Z - FUERA DE OPERACION'
        laboral.save()

        # 3. Liberacion de vehiculo
        movilidad.placa_vehiculo = None
        movilidad.save()

        # 4. Regla Legacy PHP: Desvinculacion automatica de cuadrilla (Lineas 667-687 de infraestructura_cinco_sas.php)
        # Si el colaborador pertenecia a una cuadrilla operativa (tipo TIRAN o movil activa)
        # y tras su retiro NO queda ningun otro TECNICO activo en dicha movil,
        # los auxiliares/colaboradores no tecnicos activos en esa movil se desvinculan a '1 - SIN ASIGNAR'.
        auxiliares_desvinculados = []
        if movil_antes and (
            'TIRAN' in movil_antes.upper()
            or ('ASIGNAR' not in movil_antes.upper() and 'FUERA' not in movil_antes.upper())
        ):
            quedan_tecnicos_activos = EmpleadoLaboral.objects.filter(
                movil=movil_antes,
                cargo='TECNICO',
                empleado__estado='ACTIVO'
            ).exists()

            if not quedan_tecnicos_activos:
                auxiliares_afectados = EmpleadoLaboral.objects.select_for_update().filter(
                    movil=movil_antes,
                    empleado__estado='ACTIVO'
                ).exclude(cargo='TECNICO')

                for aux_lab in auxiliares_afectados:
                    aux_perfil = aux_lab.empleado
                    datos_antes_aux = {
                        'movil': aux_lab.movil,
                    }
                    aux_lab.movil = '1 - SIN ASIGNAR'
                    aux_lab.save()

                    auxiliares_desvinculados.append({
                        'id': aux_perfil.id,
                        'nombre_completo': aux_perfil.nombre_completo,
                        'numero_documento': aux_perfil.numero_documento,
                        'cargo': aux_lab.cargo,
                    })

                    if user_operator:
                        cls.registrar_auditoria(
                            empleado=aux_perfil,
                            usuario=user_operator,
                            accion='DESVINCULACION_CUADRILLA_AUTOMATICA',
                            tabla_afectada='empleados_laboral',
                            datos_anteriores=datos_antes_aux,
                            datos_nuevos={
                                'movil': '1 - SIN ASIGNAR',
                                'motivo': f'Desvinculacion automatica por retiro del tecnico de la cuadrilla {movil_antes} ({perfil.nombre_completo})',
                            },
                            ip_origen=ip_address
                        )

        perfil.auxiliares_desvinculados = auxiliares_desvinculados

        datos_nuevos = {
            'estado': 'INACTIVO',
            'is_active': False,
            'fecha_egreso': str(fecha_egreso),
            'motivo': motivo,
            'motivo_real': motivo_real,
            'movil': 'Z - FUERA DE OPERACION',
            'placa_vehiculo': None,
            'auxiliares_desvinculados_count': len(auxiliares_desvinculados),
        }

        if user_operator:
            cls.registrar_auditoria(
                empleado=perfil,
                usuario=user_operator,
                accion='DESACTIVACION',
                tabla_afectada='empleados_perfil',
                datos_anteriores=datos_antes,
                datos_nuevos=datos_nuevos,
                ip_origen=ip_address
            )

        return perfil

    @classmethod
    def obtener_movil_previa_desactivacion(cls, empleado_id: int) -> str:
        """
        Consulta en el historial de auditoría el último móvil que tuvo el colaborador
        antes de ser desactivado (Equivale a Líneas 845-851 de infraestructura_cinco_sas.php).
        """
        # 1. Buscar en el log de DESACTIVACION más reciente
        log_desactivacion = EmpleadoAuditoriaLog.objects.filter(
            empleado_id=empleado_id,
            accion='DESACTIVACION'
        ).order_by('-created_at').first()

        if log_desactivacion and log_desactivacion.datos_anteriores:
            movil_ant = log_desactivacion.datos_anteriores.get('movil')
            if movil_ant and 'FUERA DE OPERACION' not in str(movil_ant).upper():
                return str(movil_ant).strip()

        # 2. Si no está en el log de desactivación, buscar en logs históricos previos
        logs_anteriores = EmpleadoAuditoriaLog.objects.filter(
            empleado_id=empleado_id
        ).order_by('-created_at')

        for log in logs_anteriores:
            if log.datos_anteriores and 'movil' in log.datos_anteriores:
                m = log.datos_anteriores.get('movil')
                if m and 'FUERA' not in str(m).upper() and str(m).strip():
                    return str(m).strip()
            if log.datos_nuevos and 'movil' in log.datos_nuevos:
                m = log.datos_nuevos.get('movil')
                if m and 'FUERA' not in str(m).upper() and str(m).strip():
                    return str(m).strip()

        return '1 - SIN ASIGNAR'

    @classmethod
    @transaction.atomic
    def reactivar_empleado(
        cls,
        empleado_id: int,
        movil_inicial: str = None,
        observaciones: str = '',
        user_operator: User = None,
        ip_address: str = None
    ) -> EmpleadoPerfil:
        """
        Equivale a reactivar (Líneas 824-981 de infraestructura_cinco_sas.php).
        1. Estado a ACTIVO y reactiva auth_user.
        2. Limpia fecha y motivo de egreso.
        3. Recupera el móvil previo desde el historial de auditoría si no se especifica uno explícito (Regla Legacy 2.7).
        4. Auto-herencia o sincronización de cuadrilla si aplica.
        """
        perfil = EmpleadoPerfil.objects.select_for_update().get(id=empleado_id)
        laboral = perfil.laboral

        perfil.estado = 'ACTIVO'
        perfil.user.is_active = True
        perfil.user.save()
        perfil.save()

        laboral.fecha_egreso = None
        laboral.motivo_egreso = None
        laboral.motivo_egreso_real = None

        # Si no se pasó un móvil o está vacío / None, recuperar del historial (Regla Legacy 2.7)
        if not movil_inicial or not str(movil_inicial).strip():
            movil_final = cls.obtener_movil_previa_desactivacion(empleado_id)
        else:
            movil_final = str(movil_inicial).strip()

        laboral.movil = movil_final or '1 - SIN ASIGNAR'
        laboral.save()

        # Si el reactivado es auxiliar y el móvil es una cuadrilla operativa con técnico activo, auto-heredar
        if 'AUXILIAR' in (laboral.cargo or '').upper() and laboral.movil and 'ASIGNAR' not in laboral.movil.upper():
            try:
                cls.sincronizar_herencia_auxiliar_desde_tecnico(
                    auxiliar_perfil=perfil,
                    user_operator=user_operator,
                    ip_address=ip_address
                )
            except Exception:
                pass
        elif 'TECNICO' in (laboral.cargo or '').upper() and laboral.movil and 'ASIGNAR' not in laboral.movil.upper():
            try:
                cls.sincronizar_cuadrilla_tecnico_auxiliar(
                    tecnico_perfil=perfil,
                    nueva_movil=laboral.movil,
                    movil_anterior='Z - FUERA DE OPERACION',
                    user_operator=user_operator,
                    ip_address=ip_address
                )
            except Exception:
                pass

        datos_nuevos = {
            'estado': 'ACTIVO',
            'movil': laboral.movil,
        }
        if observaciones:
            datos_nuevos['observaciones'] = observaciones

        cls.registrar_auditoria(
            empleado=perfil,
            usuario=user_operator,
            accion='REACTIVACION',
            tabla_afectada='empleados_perfil',
            datos_anteriores={'estado': 'INACTIVO', 'movil': 'Z - FUERA DE OPERACION'},
            datos_nuevos=datos_nuevos,
            ip_origen=ip_address
        )

        perfil.movil_restaurado = laboral.movil
        return perfil

    @classmethod
    @transaction.atomic
    def gestionar_cuenta_bancaria(
        cls,
        empleado_id: int,
        banco: str,
        numero_cuenta: str,
        tipo_cuenta: str = 'AHORROS',
        es_nomina: bool = True,
        titular: str = '',
        cc_titular: str = '',
        cuenta_id: int = None,
        user_operator: User = None,
        ip_address: str = None
    ) -> EmpleadoCuentaBancaria:
        """
        Equivale a save_cuenta_bank (Líneas 282-388 de infraestructura_cinco_sas.php).
        1. Normaliza cuenta a 12 dígitos.
        2. Si es_nomina = True, garantiza exclusividad desactivando la nómina en las demás cuentas.
        3. Crea o actualiza EmpleadoCuentaBancaria.
        """
        perfil = EmpleadoPerfil.objects.get(id=empleado_id)
        nro_norm = cls.normalizar_numero_cuenta(numero_cuenta)

        if not titular:
            titular = perfil.nombre_completo
        if not cc_titular:
            cc_titular = perfil.numero_documento

        if es_nomina:
            EmpleadoCuentaBancaria.objects.filter(empleado_id=empleado_id).update(es_nomina=False)

        if cuenta_id:
            cuenta = EmpleadoCuentaBancaria.objects.get(id=cuenta_id, empleado_id=empleado_id)
            cuenta.banco = banco
            cuenta.numero_cuenta = nro_norm
            cuenta.tipo_cuenta = tipo_cuenta
            cuenta.es_nomina = es_nomina
            cuenta.titular = titular
            cuenta.cc_titular = cc_titular
            cuenta.save()
            accion = 'ACTUALIZACION_CUENTA'
        else:
            cuenta = EmpleadoCuentaBancaria.objects.create(
                empleado=perfil,
                banco=banco,
                tipo_cuenta=tipo_cuenta,
                numero_cuenta=nro_norm,
                es_nomina=es_nomina,
                titular=titular,
                cc_titular=cc_titular,
            )
            accion = 'CREACION_CUENTA'

        if user_operator:
            cls.registrar_auditoria(
                empleado=perfil,
                usuario=user_operator,
                accion=accion,
                tabla_afectada='empleados_cuentas_bancarias',
                datos_nuevos={
                    'banco': banco,
                    'numero_cuenta': nro_norm,
                    'es_nomina': es_nomina,
                },
                ip_origen=ip_address
            )

        return cuenta


    @classmethod
    @transaction.atomic
    def gestionar_contacto_emergencia(
        cls,
        empleado_id: int,
        nombre_completo: str,
        parentesco: str,
        telefono: str,
        es_principal: bool = False,
        contacto_id: int = None,
        user_operator: User = None,
        ip_address: str = None
    ):
        """
        Alta o edición de contacto de emergencia (Tabla 9: empleados_contactos_emergencia).
        Si es_principal = True, desmarca los demás contactos como principal.
        """
        from apps.empleados.models import EmpleadoContactoEmergencia
        perfil = EmpleadoPerfil.objects.get(id=empleado_id)

        nombre_completo = nombre_completo.strip().upper()
        parentesco = parentesco.strip().upper()
        telefono = telefono.strip()

        if es_principal:
            EmpleadoContactoEmergencia.objects.filter(empleado_id=empleado_id).update(es_principal=False)

        if contacto_id:
            contacto = EmpleadoContactoEmergencia.objects.get(id=contacto_id, empleado_id=empleado_id)
            datos_antes = {
                'nombre_completo': contacto.nombre_completo,
                'parentesco': contacto.parentesco,
                'telefono': contacto.telefono,
                'es_principal': contacto.es_principal,
            }
            contacto.nombre_completo = nombre_completo
            contacto.parentesco = parentesco
            contacto.telefono = telefono
            contacto.es_principal = es_principal
            contacto.save()
            accion = 'ACTUALIZACION_CONTACTO_EMERGENCIA'
        else:
            datos_antes = None
            contacto = EmpleadoContactoEmergencia.objects.create(
                empleado=perfil,
                nombre_completo=nombre_completo,
                parentesco=parentesco,
                telefono=telefono,
                es_principal=es_principal,
            )
            accion = 'CREACION_CONTACTO_EMERGENCIA'

        if user_operator:
            cls.registrar_auditoria(
                empleado=perfil,
                usuario=user_operator,
                accion=accion,
                tabla_afectada='empleados_contactos_emergencia',
                datos_anteriores=datos_antes,
                datos_nuevos={
                    'nombre_completo': nombre_completo,
                    'parentesco': parentesco,
                    'telefono': telefono,
                    'es_principal': es_principal,
                },
                ip_origen=ip_address
            )

        return contacto

    @classmethod
    @transaction.atomic
    def eliminar_contacto_emergencia(
        cls,
        empleado_id: int,
        contacto_id: int,
        user_operator: User = None,
        ip_address: str = None
    ):
        """
        Elimina un contacto de emergencia y genera traza de auditoría.
        """
        from apps.empleados.models import EmpleadoContactoEmergencia
        perfil = EmpleadoPerfil.objects.get(id=empleado_id)
        contacto = EmpleadoContactoEmergencia.objects.get(id=contacto_id, empleado_id=empleado_id)
        datos_antes = {
            'id': contacto.id,
            'nombre_completo': contacto.nombre_completo,
            'parentesco': contacto.parentesco,
            'telefono': contacto.telefono,
            'es_principal': contacto.es_principal,
        }
        contacto.delete()

        if user_operator:
            cls.registrar_auditoria(
                empleado=perfil,
                usuario=user_operator,
                accion='ELIMINACION_CONTACTO_EMERGENCIA',
                tabla_afectada='empleados_contactos_emergencia',
                datos_anteriores=datos_antes,
                datos_nuevos=None,
                ip_origen=ip_address
            )

    @classmethod
    @transaction.atomic
    def restablecer_contrasena(
        cls,
        perfil: EmpleadoPerfil,
        operador: User,
        ip_origen: str = None
    ) -> dict:
        """
        Regla Legacy: restaurarcontra (Línea 2009 de infraestructura_cinco_sas.php).
        Genera una contraseña temporal segura que cumple la política de complejidad,
        la asigna a la cuenta auth_user vinculada al colaborador y registra traza de auditoría.
        """
        import secrets

        user = getattr(perfil, 'user', None)
        if not user:
            user = User.objects.filter(username=perfil.numero_documento).first()
            if not user:
                user = User.objects.create_user(
                    username=perfil.numero_documento,
                    first_name=perfil.nombres[:30],
                    last_name=perfil.apellidos[:30],
                )
            perfil.user = user
            perfil.save(update_fields=['user'])

        if user.is_superuser:
            raise ValidationError(
                "No está permitido restablecer la contraseña de un superadministrador desde este módulo."
            )

        # Complejidad: Mayúscula, minúscula, número, especial, >= 8 caracteres
        sufijo_hex = secrets.token_hex(2).upper()
        num_aleatorio = secrets.randbelow(90) + 10
        temp_password = f"Cinco.{sufijo_hex}!{num_aleatorio}"

        user.set_password(temp_password)
        user.save(update_fields=['password'])

        # Auditoría obligatoria (Habeas Data) sin registrar la contraseña en claro
        cls.registrar_auditoria(
            empleado=perfil,
            usuario=operador,
            accion='RESTABLECER_CONTRASENA',
            tabla_afectada='auth_user',
            datos_anteriores=None,
            datos_nuevos={
                'motivo': 'Generación de clave temporal para acceso al sistema',
                'username': user.username,
            },
            ip_origen=ip_origen
        )

        return {
            'success': True,
            'username': user.username,
            'temp_password': temp_password,
            'mensaje': f"Se ha generado una nueva contraseña temporal para {perfil.nombres} {perfil.apellidos}."
        }

    @classmethod
    def consultar_historial_dotacion_integral(
        cls,
        empleado_id: int,
        numero_documento: str
    ) -> dict:
        """
        Consulta unificada del historial de dotación (Punto 2.11):
        1. Comprobantes y actas digitales subidos en app-cinco (db_cincosas.empleados_dotacion_comprobantes).
        2. Actas históricas escaneadas en bd_c3nc4s1s.sst_base_entrega_dotacion (Legacy azul).
        3. Despachos físicos de dotación y EPP desde bodega de Logística
           (l4g3st3c1_c4ntr4l_3nv2nt1r34.control_inventario_movimientos_entrega).
        """
        actas = []

        # 1. Comprobantes subidos en app-cinco
        try:
            comprobantes_locales = EmpleadoDotacionComprobante.objects.filter(
                empleado_id=empleado_id
            ).select_related('subido_por').order_by('-fecha_entrega', '-id')

            for comp in comprobantes_locales:
                subido_nombre = ''
                if comp.subido_por:
                    subido_nombre = comp.subido_por.get_full_name() or comp.subido_por.username

                actas.append({
                    'id': f"app_{comp.id}",
                    'comprobante_id': comp.id,
                    'origen': 'APP_CINCO',
                    'origen_label': 'App Cinco',
                    'fecha_entrega': comp.fecha_entrega.strftime('%Y-%m-%d') if comp.fecha_entrega else '',
                    'observaciones': comp.observaciones or '',
                    'archivo_url': comp.archivo_url,
                    'subido_por': subido_nombre or 'Sistema',
                    'created_at': comp.created_at.strftime('%Y-%m-%d %H:%M') if comp.created_at else '',
                    'es_eliminable': True,
                })
        except Exception as e:
            logger.warning(f"Error al consultar comprobantes locales de dotación: {e}")

        # 2. Actas históricas del legacy (sst_base_entrega_dotacion en azul)
        doc_limpio = str(numero_documento).strip() if numero_documento else ''
        if doc_limpio:
            try:
                conn_azul = connections['azul']
                with conn_azul.cursor() as c_azul:
                    c_azul.execute(
                        """
                        SELECT id, fecha, url, edit, fecha_edit
                        FROM sst_base_entrega_dotacion
                        WHERE cedula = %s
                        ORDER BY fecha DESC
                        """,
                        [doc_limpio]
                    )
                    rows = c_azul.fetchall()
                    for r in rows:
                        acta_id, fecha, raw_url, editor, f_edit = r
                        url_limpia = str(raw_url).strip() if raw_url else ''
                        if url_limpia:
                            if url_limpia.startswith('http://') or url_limpia.startswith('https://'):
                                full_url = url_limpia
                            else:
                                clean_path = url_limpia.lstrip('/')
                                full_url = f"https://www.cincosas.com/2mp21d4s/{clean_path}"
                        else:
                            full_url = ''

                        f_str = fecha.strftime('%Y-%m-%d') if fecha else ''
                        f_edit_str = f_edit.strftime('%Y-%m-%d %H:%M') if f_edit else ''

                        actas.append({
                            'id': f"legacy_{acta_id}",
                            'comprobante_id': acta_id,
                            'origen': 'LEGACY_SST',
                            'origen_label': 'Legacy SST',
                            'fecha_entrega': f_str,
                            'observaciones': 'Acta física escaneada registrada en el sistema Legacy',
                            'archivo_url': full_url,
                            'subido_por': str(editor).strip() if editor else 'Sistema Legacy',
                            'created_at': f_edit_str,
                            'es_eliminable': False,
                        })
            except Exception as e:
                logger.warning(f"Error al consultar actas históricas en sst_base_entrega_dotacion: {e}")

        # Ordenar todas las actas unificadas por fecha_entrega desc
        actas.sort(key=lambda x: x.get('fecha_entrega') or '', reverse=True)

        # 3. Despachos físicos de prendas y EPP desde bodega de Logística
        despachos = []
        if doc_limpio:
            try:
                conn_azul = connections['azul']
                with conn_azul.cursor() as c_log:
                    c_log.execute(
                        """
                        SELECT 
                            e.id, 
                            e.fecha, 
                            e.ticket, 
                            e.codigo, 
                            COALESCE(bc.descripcion, e.codigo) AS descripcion,
                            COALESCE(bc.talla, '') AS talla,
                            e.cantidad, 
                            e.sede, 
                            e.observaciones
                        FROM l4g3st3c1_c4ntr4l_3nv2nt1r34.control_inventario_movimientos_entrega AS e
                        LEFT JOIN l4g3st3c1_c4ntr4l_3nv2nt1r34.control_inventario_base_codigos AS bc ON e.codigo = bc.codigo
                        WHERE e.cedula = %s 
                          AND (e.categoria IN ('DOTACION', 'SST') OR e.sub_categoria IN ('DOTACION', 'EPP', 'EPCC'))
                        ORDER BY e.fecha DESC
                        """,
                        [doc_limpio]
                    )
                    rows_despachos = c_log.fetchall()
                    for rd in rows_despachos:
                        did, dfecha, dticket, dcodigo, ddesc, dtalla, dcant, dsede, dobs = rd
                        f_desp = dfecha.strftime('%Y-%m-%d %H:%M') if dfecha else ''
                        despachos.append({
                            'id': did,
                            'fecha': f_desp,
                            'ticket': str(dticket or '').strip(),
                            'codigo': str(dcodigo or '').strip(),
                            'descripcion': str(ddesc or '').strip(),
                            'talla': str(dtalla or '').strip(),
                            'cantidad': int(dcant) if dcant is not None else 1,
                            'sede': str(dsede or '').strip(),
                            'observaciones': str(dobs or '').strip(),
                        })
            except Exception as e:
                logger.warning(f"Error al consultar despachos en control_inventario_movimientos_entrega: {e}")

        return {
            'success': True,
            'actas_comprobantes': actas,
            'despachos_bodega': despachos,
            'cnt_actas': len(actas),
            'cnt_despachos': len(despachos),
        }

