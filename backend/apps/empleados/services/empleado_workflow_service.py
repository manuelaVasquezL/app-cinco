import re
from datetime import timedelta
from django.db import transaction, connection
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
    EmpleadoMovilidad,
    EmpleadoCuentaBancaria,
    EmpleadoAuditoriaLog,
)

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
        """
        return EmpleadoAuditoriaLog.objects.create(
            empleado=empleado,
            usuario=usuario,
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

        # 3. Laboral en etapa de formación
        EmpleadoLaboral.objects.create(
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
            practica_lectiva_inicio=laboral_data.get('practica_lectiva_inicio'),
            practica_lectiva_fin=laboral_data.get('practica_lectiva_fin'),
            practica_productiva_inicio=laboral_data.get('practica_productiva_inicio'),
            practica_productiva_fin=laboral_data.get('practica_productiva_fin'),
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

        return movilidad

    @classmethod
    @transaction.atomic
    def sincronizar_cuadrilla_tecnico_auxiliar(
        cls,
        tecnico_perfil: EmpleadoPerfil,
        nueva_movil: str,
        user_operator: User = None,
        ip_address: str = None
    ):
        """
        Replica la regla legacy de cuadrillas (Líneas 3050-3158 de infraestructura_cinco_sas.php):
        - Si el técnico cambia de móvil y no es 'SIN ASIGNAR', los auxiliares en esa móvil
          heredan el supervisor, área y carpeta del técnico.
        - Si el técnico pasa a '1 - SIN ASIGNAR', los auxiliares en la móvil anterior se desvinculan.
        """
        laboral_tec = tecnico_perfil.laboral
        if laboral_tec.cargo != 'TECNICO':
            return

        movil_ant = laboral_tec.movil

        if nueva_movil and "ASIGNAR" not in nueva_movil.upper():
            auxiliares = EmpleadoLaboral.objects.filter(
                movil=nueva_movil,
                cargo='AUXILIAR',
                empleado__estado='ACTIVO'
            )
            for aux_lab in auxiliares:
                datos_antes = {
                    'supervisor_id': aux_lab.supervisor_id,
                    'area': aux_lab.area,
                    'carpeta': aux_lab.carpeta,
                }
                aux_lab.supervisor = laboral_tec.supervisor
                aux_lab.area = laboral_tec.area
                aux_lab.carpeta = laboral_tec.carpeta
                aux_lab.save()

                if user_operator:
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
                        },
                        ip_origen=ip_address
                    )

        elif "ASIGNAR" in nueva_movil.upper() and movil_ant:
            # Si el técnico se desasigna, desasignar al auxiliar vinculado
            auxiliares = EmpleadoLaboral.objects.filter(
                movil=movil_ant,
                cargo='AUXILIAR',
                empleado__estado='ACTIVO'
            )
            for aux_lab in auxiliares:
                aux_lab.movil = '1 - SIN ASIGNAR'
                aux_lab.save()

                if user_operator:
                    cls.registrar_auditoria(
                        empleado=aux_lab.empleado,
                        usuario=user_operator,
                        accion='DESVINCULACION_CUADRILLA',
                        tabla_afectada='empleados_laboral',
                        datos_anteriores={'movil': movil_ant},
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
        Equivale a send_desactivar_empleado (Líneas 622-823 de infraestructura_cinco_sas.php).
        1. Estado a INACTIVO y revoca accesos en auth_user.
        2. Registra fecha de egreso, motivo y motivo real.
        3. Pasa móvil a 'Z - FUERA DE OPERACION'.
        4. Libera la placa vehicular asignada.
        """
        perfil = EmpleadoPerfil.objects.select_for_update().get(id=empleado_id)
        laboral = perfil.laboral
        movilidad, _ = EmpleadoMovilidad.objects.get_or_create(empleado=perfil)

        datos_antes = {
            'estado': perfil.estado,
            'is_active': perfil.user.is_active,
            'movil': laboral.movil,
            'placa_vehiculo': movilidad.placa_vehiculo,
        }

        # 1. Desactivación de cuenta e identidad
        perfil.estado = 'INACTIVO'
        perfil.user.is_active = False
        perfil.user.save()
        perfil.save()

        # 2. Desactivación laboral
        laboral.fecha_egreso = fecha_egreso
        laboral.motivo_egreso = motivo
        laboral.motivo_egreso_real = motivo_real
        laboral.movil = 'Z - FUERA DE OPERACION'
        laboral.save()

        # 3. Liberación de vehículo
        movilidad.placa_vehiculo = None
        movilidad.save()

        datos_nuevos = {
            'estado': 'INACTIVO',
            'is_active': False,
            'fecha_egreso': str(fecha_egreso),
            'motivo': motivo,
            'motivo_real': motivo_real,
            'movil': 'Z - FUERA DE OPERACION',
            'placa_vehiculo': None,
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
    @transaction.atomic
    def reactivar_empleado(
        cls,
        empleado_id: int,
        movil_inicial: str = '1 - SIN ASIGNAR',
        user_operator: User = None,
        ip_address: str = None
    ) -> EmpleadoPerfil:
        """
        Equivale a reactivar (Líneas 824-981 de infraestructura_cinco_sas.php).
        1. Estado a ACTIVO y reactiva auth_user.
        2. Limpia fecha y motivo de egreso.
        3. Restaura móvil inicial o '1 - SIN ASIGNAR'.
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
        laboral.movil = movil_inicial or '1 - SIN ASIGNAR'
        laboral.save()

        if user_operator:
            cls.registrar_auditoria(
                empleado=perfil,
                usuario=user_operator,
                accion='REACTIVACION',
                tabla_afectada='empleados_perfil',
                datos_nuevos={'estado': 'ACTIVO', 'movil': laboral.movil},
                ip_origen=ip_address
            )

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
