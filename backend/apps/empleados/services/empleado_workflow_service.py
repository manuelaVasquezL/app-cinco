import re
import logging
import calendar
from datetime import timedelta, date
from typing import Optional, Dict, Any, List, Union
from django.db import transaction, connection, connections
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from apps.empleados.models import (
    Empleado,
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
    EmpleadoContactoEmergencia,
    EmpleadoPersonaACargo,
    EmpleadoDocumentoAdjunto,
)

logger = logging.getLogger(__name__)

User: Any = get_user_model()


class EmpleadoWorkflowService:
    """
    Capa de servicio y lógica de dominio para la gestión del ciclo de vida
    del empleado, cuadrillas, flota, inducción y auditoría.
    """

    @staticmethod
    def parse_date(val):
        if not val:
            return None
        from datetime import datetime as dt_cls, date as d_cls
        if isinstance(val, dt_cls):
            return val.date()
        if isinstance(val, d_cls):
            return val
        try:
            return dt_cls.strptime(str(val)[:10], '%Y-%m-%d').date()
        except Exception:
            return None

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
                raise ValidationError("Formato de fecha de ingreso inválido. Use AAAA-MM-DD.")
        fecha_limite = timezone.now().date() + timedelta(days=5)
        if isinstance(fecha_ingreso, date) and fecha_ingreso > fecha_limite:
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
                fecha = datetime.strptime(fecha[:10], '%Y-%m-%d').date()
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
        limpio = re.sub(r'\D', '', nro)
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
        usuario: Optional[Any] = None,
        accion: str = "",
        tabla_afectada: str = "",
        datos_anteriores: Optional[Dict[str, Any]] = None,
        datos_nuevos: Optional[Dict[str, Any]] = None,
        ip_origen: Optional[str] = None
    ) -> Optional[EmpleadoAuditoriaLog]:
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
    def crear_empleado(cls, data: dict, user_creator: Optional[Any] = None, ip_address: Optional[str] = None) -> EmpleadoPerfil:
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

        fecha_ingreso = cls.parse_date(fecha_ingreso)

        # 2. Perfil
        perfil = EmpleadoPerfil.objects.create(
            user=user,
            tipo_documento=data.get('tipo_documento', 'CC'),
            numero_documento=doc,
            fecha_expedicion_documento=cls.parse_date(data.get('fecha_expedicion_documento')),
            pasaporte=data.get('pasaporte'),
            nombres=nombres,
            apellidos=apellidos,
            fecha_nacimiento=cls.parse_date(data.get('fecha_nacimiento')),
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
            supervisor_id=laboral_data.get('supervisor_id') or laboral_data.get('supervisor'),
            padrino_id=laboral_data.get('padrino_id') or laboral_data.get('padrino'),
            formador=laboral_data.get('formador'),
            grupo_comisiones=laboral_data.get('grupo_comisiones'),
            nivel_estudio=laboral_data.get('nivel_estudio'),
            fecha_ingreso=fecha_ingreso,
            etapa_induccion=laboral_data.get('etapa_induccion', 'EN_FORMACION'),
            practica_lectiva_inicio=cls.parse_date(p_lect_inicio),
            practica_lectiva_fin=cls.parse_date(p_lect_fin),
            practica_productiva_inicio=cls.parse_date(p_prod_inicio),
            practica_productiva_fin=cls.parse_date(p_prod_fin),
            tipo_contrato=laboral_data.get('tipo_contrato'),
            duracion_contrato=laboral_data.get('duracion_contrato'),
            fecha_inicio_contrato=cls.parse_date(laboral_data.get('fecha_inicio_contrato')),
            fecha_fin_contrato=cls.parse_date(laboral_data.get('fecha_fin_contrato')),
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
            fecha_entrega_carnet=cls.parse_date(dot_data.get('fecha_entrega_carnet')),
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
            vencimiento_alturas=cls.parse_date(sst_data.get('vencimiento_alturas')),
            certificado_tecnico_url=sst_data.get('certificado_tecnico_url'),
            vencimiento_tecnico=cls.parse_date(sst_data.get('vencimiento_tecnico')),
        )

        # Contactos de emergencia iniciales
        for ce in data.get('contactos_emergencia', []):
            if isinstance(ce, dict) and (ce.get('nombre_completo') or ce.get('nombre')):
                EmpleadoContactoEmergencia.objects.create(
                    empleado=perfil,
                    nombre_completo=(ce.get('nombre_completo') or ce.get('nombre', '')).strip().upper()[:150],
                    parentesco=(ce.get('parentesco') or 'Contacto').strip().upper()[:50],
                    telefono=(ce.get('telefono') or 'N/A').strip()[:50],
                    es_principal=bool(ce.get('es_principal', False)),
                )

        # Personas a cargo iniciales
        for pac in data.get('personas_a_cargo', []):
            if isinstance(pac, dict) and (pac.get('nombre_completo') or pac.get('nombre')):
                EmpleadoPersonaACargo.objects.create(
                    empleado=perfil,
                    nombre_completo=(pac.get('nombre_completo') or pac.get('nombre', '')).strip().upper()[:150],
                    parentesco=(pac.get('parentesco') or 'Hijo(a)').strip().upper()[:50],
                    tipo_documento=pac.get('tipo_documento') or 'RC',
                    numero_documento=pac.get('numero_documento') or '',
                    fecha_nacimiento=cls.parse_date(pac.get('fecha_nacimiento')),
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
        user_operator: Optional[Any] = None,
        ip_address: Optional[str] = None
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
        if user_operator and getattr(user_operator, 'empleado_perfil', None):
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
        placa: Optional[str] = None,
        conduce: bool = False,
        medio_transporte: str = 'NINGUNO',
        modelo_vehiculo: str = '',
        user_operator: Optional[Any] = None,
        ip_address: Optional[str] = None
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
        nueva_placa: Optional[str] = None,
        conduce: bool | str = False,
        medio_transporte: str = 'NINGUNO',
        placa_anterior: Optional[str] = None,
        user_operator: Optional[Any] = None
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

        cedula = (empleado_perfil.numero_documento or '').strip()
        if not cedula:
            resultado['errores'].append("El empleado no posee número de documento.")
            return resultado

        edit_user = (user_operator.username if user_operator else 'SISTEMA').strip()
        placa_clean = nueva_placa.strip().upper() if nueva_placa else ''
        placa_ant_clean = placa_anterior.strip().upper() if placa_anterior else ''

        conduce_val = 'SI' if (conduce is True or str(conduce).strip().upper() in ('SI', '1', 'TRUE')) else 'NO'
        transporte_val = (medio_transporte or 'NINGUNO').strip().upper()

        laboral = getattr(empleado_perfil, 'laboral', None)
        if not laboral:
            laboral = EmpleadoLaboral.objects.filter(empleado=empleado_perfil).first()
        area = (laboral.area or '').strip() if laboral else ''
        carpeta = (laboral.carpeta or '').strip() if laboral else ''

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
        user_operator: Optional[Any] = None,
        ip_address: Optional[str] = None
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
        movil_anterior: Optional[str] = None,
        user_operator: Optional[Any] = None,
        ip_address: Optional[str] = None
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
        user_operator: Optional[Any] = None,
        ip_address: Optional[str] = None
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

        user_auth: Any = perfil.user
        datos_antes = {
            'estado': perfil.estado,
            'is_active': bool(user_auth and getattr(user_auth, 'is_active', False)),
            'movil': laboral.movil,
            'placa_vehiculo': movilidad.placa_vehiculo,
        }

        # 1. Desactivacion de cuenta e identidad
        perfil.estado = 'INACTIVO'
        if user_auth:
            user_auth.is_active = False
            user_auth.save()
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

        # 6. Notificación Institucional por Correo (Puntos 2.2 y 6 - Outbox Pattern)
        try:
            from apps.common.services.notificacion_correo_service import NotificacionCorreoService
            NotificacionCorreoService.encolar_egreso(
                perfil=perfil,
                fecha_egreso=fecha_egreso,
                motivo=motivo,
                usuario_operador=user_operator
            )
        except Exception as e:
            logger.error(f"Error al encolar notificación de egreso para empleado #{perfil.id}: {e}", exc_info=True)

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
            movil_ant = str(log_desactivacion.datos_anteriores.get('movil') or '').strip()
            if movil_ant and 'FUERA DE OPERACION' not in movil_ant.upper():
                return movil_ant

        # 2. Si no está en el log de desactivación, buscar en logs históricos previos
        logs_anteriores = EmpleadoAuditoriaLog.objects.filter(
            empleado_id=empleado_id
        ).order_by('-created_at')

        for log in logs_anteriores:
            if log.datos_anteriores and 'movil' in log.datos_anteriores:
                m = str(log.datos_anteriores.get('movil') or '').strip()
                if m and 'FUERA' not in m.upper():
                    return m
            if log.datos_nuevos and 'movil' in log.datos_nuevos:
                m = str(log.datos_nuevos.get('movil') or '').strip()
                if m and 'FUERA' not in m.upper():
                    return m

        return '1 - SIN ASIGNAR'

    @classmethod
    @transaction.atomic
    def reactivar_empleado(
        cls,
        empleado_id: int,
        movil_inicial: Optional[str] = None,
        observaciones: str = '',
        user_operator: Optional[Any] = None,
        ip_address: Optional[str] = None
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
        user_auth: Any = perfil.user
        if user_auth:
            user_auth.is_active = True
            user_auth.save()
        perfil.save()

        laboral.fecha_egreso = None
        laboral.motivo_egreso = None
        laboral.motivo_egreso_real = None

        # Si no se pasó un móvil o está vacío / None, recuperar del historial (Regla Legacy 2.7)
        if not movil_inicial or not movil_inicial.strip():
            movil_final = cls.obtener_movil_previa_desactivacion(empleado_id)
        else:
            movil_final = movil_inicial.strip()

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

        # Notificación Institucional por Correo (Puntos 2.2 y 6 - Outbox Pattern)
        try:
            from apps.common.services.notificacion_correo_service import NotificacionCorreoService
            NotificacionCorreoService.encolar_reactivacion(
                perfil=perfil,
                movil_asignado=laboral.movil,
                usuario_operador=user_operator
            )
        except Exception as e:
            logger.error(f"Error al encolar notificación de reactivación para empleado #{perfil.id}: {e}", exc_info=True)

        return perfil

    @classmethod
    @transaction.atomic
    def solicitar_cambio_area(
        cls,
        empleado_id: int,
        solicitante_usuario: Optional[Any] = None,
        nueva_area: str = '',
        nueva_carpeta: str = '',
        motivo: str = '',
        ip_address: Optional[str] = None
    ):
        """
        Equivale a enviar_solicitud_cambio_area (Líneas 678-815 de infraestructura_cinco_sas.php).
        Registra la auditoría y encola la notificación formal en notificaciones_correo hacia GH y Programación.
        """
        perfil = EmpleadoPerfil.objects.get(id=empleado_id)
        laboral = getattr(perfil, 'laboral', None)

        cls.registrar_auditoria(
            empleado=perfil,
            usuario=solicitante_usuario,
            accion='SOLICITUD_TRASLADO',
            tabla_afectada='empleados_laboral',
            datos_anteriores={
                'area': laboral.area if laboral else '',
                'carpeta': laboral.carpeta if laboral else '',
            },
            datos_nuevos={
                'area_solicitada': nueva_area,
                'carpeta_solicitada': nueva_carpeta,
                'motivo': motivo,
            },
            ip_origen=ip_address
        )

        from apps.common.services.notificacion_correo_service import NotificacionCorreoService
        return NotificacionCorreoService.encolar_solicitud_traslado(
            empleado_perfil=perfil,
            solicitante_usuario=solicitante_usuario,
            nueva_area=nueva_area,
            nueva_carpeta=nueva_carpeta,
            motivo=motivo
        )

    @classmethod
    def obtener_catalogo_areas_carpetas(cls) -> dict:
        """
        Retorna el catálogo agrupado de áreas y sus correspondientes carpetas operativas
        consultando exclusivamente la tabla EmpleadoLaboral en la base de datos default.
        Utiliza caché de Django para respuestas de alta velocidad.
        """
        from django.core.cache import cache
        cache_key = 'empleados_catalogo_areas_carpetas_laboral'
        cached_data = cache.get(cache_key)
        if cached_data:
            return cached_data

        from collections import defaultdict
        mapping = defaultdict(set)

        # Consultar exclusivamente de EmpleadoLaboral (BD default)
        pares_laboral = EmpleadoLaboral.objects.exclude(
            area__isnull=True
        ).exclude(
            area=''
        ).values_list('area', 'carpeta').distinct()

        for a, c in pares_laboral:
            a_clean = (a or '').strip().upper()
            c_clean = (c or '').strip().upper()
            if a_clean and a_clean not in ('-1', '0', 'N/A', 'NONE'):
                if c_clean and c_clean not in ('-1', '0', 'N/A', 'NONE'):
                    mapping[a_clean].add(c_clean)
                elif a_clean not in mapping:
                    mapping[a_clean] = set()

        areas_ordenadas = sorted(list(mapping.keys()))
        carpetas_por_area = {
            area: sorted(list(mapping[area]))
            for area in areas_ordenadas
        }

        data = {
            'areas': areas_ordenadas,
            'carpetas_por_area': carpetas_por_area,
        }

        cache.set(cache_key, data, timeout=3600)
        return data

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
        cuenta_id: Optional[int] = None,
        user_operator: Optional[Any] = None,
        ip_address: Optional[str] = None
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
        contacto_id: Optional[int] = None,
        user_operator: Optional[Any] = None,
        ip_address: Optional[str] = None
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
        user_operator: Optional[Any] = None,
        ip_address: Optional[str] = None
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
    def gestionar_persona_a_cargo(
        cls,
        empleado_id: int,
        nombre_completo: str,
        parentesco: str,
        tipo_documento: Optional[str] = None,
        numero_documento: Optional[str] = None,
        fecha_nacimiento: Optional[Any] = None,
        persona_id: Optional[int] = None,
        user_operator: Optional[Any] = None,
        ip_address: Optional[str] = None
    ):
        """
        Alta o edición de persona a cargo / beneficiario (Tabla 10: empleados_personas_a_cargo).
        """
        from apps.empleados.models import EmpleadoPersonaACargo
        perfil = EmpleadoPerfil.objects.get(id=empleado_id)

        nombre_completo = (nombre_completo or '').strip().upper()
        parentesco = (parentesco or '').strip().upper()
        tipo_documento = (tipo_documento or '').strip().upper() or None
        numero_documento = (numero_documento or '').strip() or None

        if persona_id:
            persona = EmpleadoPersonaACargo.objects.get(id=persona_id, empleado_id=empleado_id)
            datos_antes = {
                'id': persona.id,
                'nombre_completo': persona.nombre_completo,
                'parentesco': persona.parentesco,
                'tipo_documento': persona.tipo_documento,
                'numero_documento': persona.numero_documento,
                'fecha_nacimiento': str(persona.fecha_nacimiento) if persona.fecha_nacimiento else None,
            }
            persona.nombre_completo = nombre_completo
            persona.parentesco = parentesco
            persona.tipo_documento = tipo_documento
            persona.numero_documento = numero_documento
            persona.fecha_nacimiento = fecha_nacimiento
            persona.save()
            accion = 'ACTUALIZACION_PERSONA_A_CARGO'
        else:
            datos_antes = None
            persona = EmpleadoPersonaACargo.objects.create(
                empleado=perfil,
                nombre_completo=nombre_completo,
                parentesco=parentesco,
                tipo_documento=tipo_documento,
                numero_documento=numero_documento,
                fecha_nacimiento=fecha_nacimiento,
            )
            accion = 'CREACION_PERSONA_A_CARGO'

        if user_operator:
            cls.registrar_auditoria(
                empleado=perfil,
                usuario=user_operator,
                accion=accion,
                tabla_afectada='empleados_personas_a_cargo',
                datos_anteriores=datos_antes,
                datos_nuevos={
                    'id': persona.id,
                    'nombre_completo': nombre_completo,
                    'parentesco': parentesco,
                    'tipo_documento': tipo_documento,
                    'numero_documento': numero_documento,
                    'fecha_nacimiento': str(fecha_nacimiento) if fecha_nacimiento else None,
                },
                ip_origen=ip_address
            )

        return persona

    @classmethod
    @transaction.atomic
    def eliminar_persona_a_cargo(
        cls,
        empleado_id: int,
        persona_id: int,
        user_operator: Optional[Any] = None,
        ip_address: Optional[str] = None
    ):
        """
        Elimina una persona a cargo y genera traza de auditoría.
        """
        from apps.empleados.models import EmpleadoPersonaACargo
        perfil = EmpleadoPerfil.objects.get(id=empleado_id)
        persona = EmpleadoPersonaACargo.objects.get(id=persona_id, empleado_id=empleado_id)
        datos_antes = {
            'id': persona.id,
            'nombre_completo': persona.nombre_completo,
            'parentesco': persona.parentesco,
            'tipo_documento': persona.tipo_documento,
            'numero_documento': persona.numero_documento,
            'fecha_nacimiento': str(persona.fecha_nacimiento) if persona.fecha_nacimiento else None,
        }
        persona.delete()

        if user_operator:
            cls.registrar_auditoria(
                empleado=perfil,
                usuario=user_operator,
                accion='ELIMINACION_PERSONA_A_CARGO',
                tabla_afectada='empleados_personas_a_cargo',
                datos_anteriores=datos_antes,
                datos_nuevos=None,
                ip_origen=ip_address
            )

    @classmethod
    @transaction.atomic
    def restablecer_contrasena(
        cls,
        perfil: EmpleadoPerfil,
        operador: Optional[Any] = None,
        ip_origen: Optional[str] = None
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
                subido_usr: Any = comp.subido_por
                if subido_usr:
                    subido_nombre = subido_usr.get_full_name() or getattr(subido_usr, 'username', '')

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
        doc_limpio = numero_documento.strip() if numero_documento else ''
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

    @classmethod
    def sincronizar_desde_legacy(cls, emp_or_id):
        """
        Sincroniza bajo demanda un colaborador desde la tabla legacy 'cinco_base_de_personal'
        (base 'azul') hacia el modelo relacional normalizado 'EmpleadoPerfil' y sus satélites
        en la base 'default'.
        Soporta búsqueda por ID de base de datos, cédula o código SAP.
        """
        from apps.empleados.models import Empleado
        emp = None
        if isinstance(emp_or_id, Empleado):
            emp = emp_or_id
        else:
            val = str(emp_or_id).strip()
            if not val or val.lower() in ('undefined', 'null', 'none', ''):
                return None
            try:
                if val.isdigit():
                    emp = Empleado.objects.filter(id=int(val)).first()
                if not emp:
                    emp = Empleado.objects.filter(cedula=val).first()
                if not emp and val.isdigit():
                    emp = Empleado.objects.filter(codigo_sap=val).first()
            except Exception as e:
                logger.warning(f"Error consultando Empleado legacy #{val}: {e}")
                return None

        if not emp:
            return None

        cedula_str = (emp.cedula or '').strip()

        # 1. Buscar si ya existe EmpleadoPerfil por cédula o id
        perfil = EmpleadoPerfil.objects.filter(numero_documento=cedula_str).first()
        if not perfil and emp.id:
            perfil = EmpleadoPerfil.objects.filter(id=emp.id).first()

        # 2. Asegurar existencia de usuario en auth_user
        user = User.objects.filter(username=cedula_str).first()
        if not user and emp.id:
            user = User.objects.filter(id=emp.id).first()
        if not user:
            user = User.objects.create_user(
                username=cedula_str,
                first_name=(emp.nombre or '')[:30].strip().upper(),
                last_name=(emp.apellido or '')[:30].strip().upper(),
                email=emp.correo_electronico_personal or emp.email_personal or '',
                is_active=((emp.estado or '').strip().upper() == 'ACTIVO')
            )

        datos = emp.datos if isinstance(emp.datos, dict) else {}

        def _clean_str(val, max_len=None):
            if val is None:
                return ''
            s = str(val).strip()
            if s.lower() in ('none', 'null', 'undefined', 'n/a'):
                return ''
            return s[:max_len] if max_len else s

        def _parse_date(val):
            if not val:
                return None
            from datetime import datetime as dt_cls, date as d_cls
            if isinstance(val, dt_cls):
                return val.date()
            if isinstance(val, d_cls):
                return val
            try:
                return dt_cls.strptime(str(val)[:10], '%Y-%m-%d').date()
            except Exception:
                return None

        # 3. Mapeo de identidad
        genero = 'OTRO'
        gen_raw = _clean_str(emp.genero).upper()
        if gen_raw in ['M', 'MASCULINO']:
            genero = 'MASCULINO'
        elif gen_raw in ['F', 'FEMENINO']:
            genero = 'FEMENINO'

        estado_civil = _clean_str(datos.get('estado_civil', 'SOLTERO')).upper()
        if estado_civil not in ['SOLTERO', 'CASADO', 'UNION_LIBRE', 'DIVORCIADO', 'VIUDO']:
            estado_civil = 'SOLTERO'

        estado = _clean_str(emp.estado or 'ACTIVO').upper()
        if estado not in ['ACTIVO', 'INACTIVO', 'SUSPENDIDO', 'RETIRADO']:
            estado = 'ACTIVO'

        foto_url = _clean_str(emp.link_foto) or 'photos/Default.png'

        if not perfil:
            perfil = getattr(user, 'empleado_perfil', None)
            if not perfil:
                perfil_kwargs = {
                    'user': user,
                    'tipo_documento': 'CC',
                    'numero_documento': cedula_str,
                    'fecha_expedicion_documento': _parse_date(emp.fexpedicion),
                    'pasaporte': emp.pasaporte or cedula_str,
                    'nombres': _clean_str(emp.nombre, 150).upper(),
                    'apellidos': _clean_str(emp.apellido, 150).upper(),
                    'fecha_nacimiento': _parse_date(emp.fnacimiento),
                    'genero': genero,
                    'estado_civil': estado_civil,
                    'foto_url': foto_url,
                    'estado': estado,
                    'datos_adicionales': datos,
                }
                if emp.id and not EmpleadoPerfil.objects.filter(id=emp.id).exists():
                    perfil_kwargs['id'] = emp.id
                perfil = EmpleadoPerfil.objects.create(**perfil_kwargs)
        else:
            if not perfil.nombres:
                perfil.nombres = _clean_str(emp.nombre, 150).upper()
            if not perfil.apellidos:
                perfil.apellidos = _clean_str(emp.apellido, 150).upper()
            if not perfil.foto_url or perfil.foto_url == 'photos/Default.png':
                perfil.foto_url = foto_url
            perfil.save()

        # 4. Sincronizar satélite EmpleadoLaboral
        tipo_labor = _clean_str(emp.tipo_labor or 'OPERATIVO').upper()
        if tipo_labor not in ['OPERATIVO', 'ADMINISTRATIVO', 'SUPERVISOR', 'TRANSVERSAL']:
            tipo_labor = 'OPERATIVO'

        practicas = datos.get('practicas', {}) if isinstance(datos, dict) else {}
        p_lectiva = practicas.get('lectiva', {}) if isinstance(practicas, dict) else {}
        p_prod = practicas.get('practica', {}) if isinstance(practicas, dict) else {}

        supervisor_perfil = None
        if emp.supervisor:
            sup_val = emp.supervisor.strip()
            if sup_val and sup_val not in ('0', 'N/A', 'None'):
                supervisor_perfil = EmpleadoPerfil.objects.filter(numero_documento=sup_val).first()
                if not supervisor_perfil and sup_val.isdigit():
                    supervisor_perfil = EmpleadoPerfil.objects.filter(id=int(sup_val)).first()

        EmpleadoLaboral.objects.update_or_create(
            empleado=perfil,
            defaults={
                'codigo_sap': _clean_str(emp.codigo_sap, 50) or cedula_str,
                'sede': _clean_str(emp.sede, 50) or 'MEDELLIN',
                'area': _clean_str(emp.area, 100),
                'carpeta': _clean_str(emp.carpeta, 100),
                'puesto': _clean_str(emp.puesto, 150),
                'movil': _clean_str(emp.movil, 50),
                'cargo': _clean_str(emp.cargo, 100),
                'funcion_cargo': _clean_str(emp.funcion_cargo, 255),
                'tipo_labor': tipo_labor,
                'zona_nodo': _clean_str(emp.zona_nodo, 100),
                'supervisor': supervisor_perfil,
                'grupo_comisiones': _clean_str(emp.grupo_comiciones, 100),
                'nivel_estudio': _clean_str(emp.nivelestudio, 100),
                'fecha_ingreso': _parse_date(emp.fecha_ingreso) or date.today(),
                'fecha_egreso': _parse_date(emp.fecha_egreso),
                'motivo_egreso': '',
                'etapa_induccion': 'ENTREGADO' if estado == 'ACTIVO' else 'EN_FORMACION',
                'practica_lectiva_inicio': _parse_date(p_lectiva.get('fecha_inicio')) if isinstance(p_lectiva, dict) else None,
                'practica_lectiva_fin': _parse_date(p_lectiva.get('fecha_fin')) if isinstance(p_lectiva, dict) else None,
                'practica_productiva_inicio': _parse_date(p_prod.get('fecha_inicio')) if isinstance(p_prod, dict) else None,
                'practica_productiva_fin': _parse_date(p_prod.get('fecha_fin')) if isinstance(p_prod, dict) else None,
            }
        )

        # 5. Sincronizar satélite EmpleadoContacto
        EmpleadoContacto.objects.update_or_create(
            empleado=perfil,
            defaults={
                'correo_corporativo': _clean_str(emp.correo, 150),
                'correo_personal': _clean_str(emp.correo_electronico_personal or emp.email_personal, 150),
                'correo_personal_verificado': bool(emp.email_verificar),
                'celular_corporativo': '',
                'celular_personal': _clean_str(emp.celular_personal, 50),
                'celular_alterno': _clean_str(emp.celular_alterno, 50),
                'telefono_fijo': _clean_str(emp.telefono_fijo, 50),
                'direccion_residencia': _clean_str(emp.direccion_residencia_actual, 255),
                'claro_pay': _clean_str(datos.get('claro_pay'), 50),
            }
        )

        # 6. Sincronizar satélite EmpleadoSeguridadSocial
        EmpleadoSeguridadSocial.objects.update_or_create(
            empleado=perfil,
            defaults={
                'eps': _clean_str(emp.eps, 100),
                'arl': _clean_str(emp.arl, 100) or 'COLMENA',
                'afp': _clean_str(emp.afp, 100),
                'esquema_vacunacion': datos.get('vacunacion'),
            }
        )

        # 7. Sincronizar satélite EmpleadoMovilidad
        EmpleadoMovilidad.objects.update_or_create(
            empleado=perfil,
            defaults={
                'placa_vehiculo': _clean_str(emp.placa, 20),
                'medio_transporte': _clean_str(datos.get('transporte'), 50),
                'sabe_conducir': _clean_str(datos.get('conduce')).upper() == 'SI',
            }
        )

        # 8. Sincronizar satélite EmpleadoDotacionActivos
        tallas = datos.get('tallas', {}) if isinstance(datos, dict) else {}
        tallas_dict = tallas if isinstance(tallas, dict) else {}
        EmpleadoDotacionActivos.objects.update_or_create(
            empleado=perfil,
            defaults={
                'tiene_carnet': bool(emp.carnet and _clean_str(emp.carnet).upper() == 'SI'),
                'fecha_entrega_carnet': _parse_date(emp.fecha_carnet),
                'talla_camisa': _clean_str(tallas_dict.get('camisa'), 10),
                'talla_pantalon': _clean_str(tallas_dict.get('pantalon'), 10),
                'talla_calzado': _clean_str(tallas_dict.get('botas'), 10),
                'talla_chaqueta': _clean_str(tallas_dict.get('chaqueta'), 10),
                'talla_guerrera': _clean_str(tallas_dict.get('guerrera'), 10),
            }
        )

        # 9. Sincronizar satélite EmpleadoCertificacionesSST
        EmpleadoCertificacionesSST.objects.update_or_create(
            empleado=perfil,
            defaults={
                'permiso_trabajo': _clean_str(emp.permiso_trabajo, 100),
            }
        )

        # 10. Sincronizar cuentas bancarias
        bancos = datos.get('datos_bancarios', [])
        if isinstance(bancos, list):
            for b in bancos:
                if isinstance(b, dict) and b.get('nro_cuenta'):
                    nro = cls.normalizar_numero_cuenta(str(b.get('nro_cuenta', '')))
                    if nro:
                        tipo_c = 'CORRIENTE' if _clean_str(b.get('tipo_cuenta')).upper() == 'CORRIENTE' else 'AHORROS'
                        EmpleadoCuentaBancaria.objects.update_or_create(
                            empleado=perfil,
                            numero_cuenta=nro,
                            defaults={
                                'banco': _clean_str(b.get('banco'), 100) or 'BANCO',
                                'tipo_cuenta': tipo_c,
                                'es_nomina': bool(b.get('nomina', True)),
                                'titular': _clean_str(b.get('titular'), 150) or perfil.nombre_completo,
                                'cc_titular': _clean_str(b.get('cc_cuenta'), 50) or perfil.numero_documento,
                            }
                        )

        # 11. Sincronizar contactos de emergencia
        contactos = datos.get('contactos_emergencia', [])
        if isinstance(contactos, list):
            for c in contactos:
                if isinstance(c, dict) and c.get('nombre'):
                    EmpleadoContactoEmergencia.objects.update_or_create(
                        empleado=perfil,
                        nombre_completo=_clean_str(c.get('nombre'), 150),
                        defaults={
                            'parentesco': _clean_str(c.get('parentesco'), 50) or 'Contacto',
                            'telefono': _clean_str(c.get('telefono'), 50) or 'N/A',
                            'es_principal': True,
                        }
                    )

        # 12. Sincronizar personas a cargo
        personas = datos.get('personas_a_cargo', [])
        if isinstance(personas, list):
            for p in personas:
                if isinstance(p, dict) and p.get('nombre'):
                    EmpleadoPersonaACargo.objects.update_or_create(
                        empleado=perfil,
                        nombre_completo=_clean_str(p.get('nombre'), 150),
                        defaults={
                            'parentesco': _clean_str(p.get('parentesco'), 50) or 'Beneficiario',
                            'numero_documento': _clean_str(p.get('documento'), 50) or None,
                            'fecha_nacimiento': _parse_date(p.get('fecha_nacimiento')),
                        }
                    )

        # 13. Sincronizar documento de identidad frontal / posterior
        doc_id = datos.get('documento_identidad', {})
        if isinstance(doc_id, dict):
            lado_a = doc_id.get('lado_a')
            lado_b = doc_id.get('lado_b')
            if lado_a:
                EmpleadoDocumentoAdjunto.objects.update_or_create(
                    empleado=perfil,
                    tipo_documento='CEDULA_FRONTAL',
                    defaults={'archivo_url': str(lado_a)}
                )
            if lado_b:
                EmpleadoDocumentoAdjunto.objects.update_or_create(
                    empleado=perfil,
                    tipo_documento='CEDULA_POSTERIOR',
                    defaults={'archivo_url': str(lado_b)}
                )

        return EmpleadoPerfil.objects.select_related(
            'laboral',
            'laboral__supervisor',
            'laboral__padrino',
            'laboral__entregado_por',
            'contacto',
            'seguridad_social',
            'certificaciones_sst',
            'dotacion_activos',
            'movilidad',
        ).prefetch_related(
            'cuentas_bancarias',
            'contactos_emergencia',
            'personas_a_cargo',
            'documentos_adjuntos',
            'comprobantes_dotacion',
        ).get(id=perfil.id)

