from rest_framework import serializers
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
    EmpleadoContactoEmergencia,
    EmpleadoPersonaACargo,
    EmpleadoDocumentoAdjunto,
    EmpleadoAuditoriaLog,
)


class EmpleadoLaboralSerializer(serializers.ModelSerializer):
    supervisor_nombre = serializers.ReadOnlyField(source='supervisor.nombre_completo')
    padrino_nombre = serializers.ReadOnlyField(source='padrino.nombre_completo')
    entregado_por_nombre = serializers.ReadOnlyField(source='entregado_por.nombre_completo')
    ciudad_operacion = serializers.CharField(source='sede', read_only=True)
    motivo_retiro_gh = serializers.CharField(source='motivo_egreso', read_only=True)
    motivo_retiro_operaciones = serializers.CharField(source='motivo_egreso_real', read_only=True)
    fecha_retiro = serializers.DateField(source='fecha_egreso', read_only=True)
    dias_para_periodo_prueba = serializers.ReadOnlyField()
    en_periodo_prueba = serializers.ReadOnlyField()
    dias_para_fin_practica = serializers.ReadOnlyField()
    etapa_practica_activa = serializers.ReadOnlyField()
    en_practicas = serializers.ReadOnlyField()

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        for fk_field in ['supervisor', 'padrino', 'entregado_por']:
            if fk_field in data and (data[fk_field] in ('', 0, '0', None)):
                data[fk_field] = None
        for date_field in [
            'fecha_ingreso', 'fecha_egreso', 'fecha_entrega_area',
            'practica_lectiva_inicio', 'practica_lectiva_fin',
            'practica_productiva_inicio', 'practica_productiva_fin'
        ]:
            if date_field in data and data[date_field] in ('', None):
                data[date_field] = None

        # Autocálculo de 6 meses para etapas de Aprendiz SENA (Regla Legacy 2.8)
        from apps.empleados.services.empleado_workflow_service import EmpleadoWorkflowService
        if data.get('practica_lectiva_inicio') and not data.get('practica_lectiva_fin'):
            fin_calc = EmpleadoWorkflowService.calcular_seis_meses_despues(data['practica_lectiva_inicio'])
            if fin_calc:
                data['practica_lectiva_fin'] = fin_calc.isoformat()

        if data.get('practica_productiva_inicio') and not data.get('practica_productiva_fin'):
            fin_calc = EmpleadoWorkflowService.calcular_seis_meses_despues(data['practica_productiva_inicio'])
            if fin_calc:
                data['practica_productiva_fin'] = fin_calc.isoformat()

        return super().to_internal_value(data)

    class Meta:
        model = EmpleadoLaboral
        fields = [
            'id',
            'codigo_sap',
            'sede',
            'ciudad_operacion',
            'area',
            'carpeta',
            'puesto',
            'movil',
            'cargo',
            'funcion_cargo',
            'tipo_labor',
            'zona_nodo',
            'supervisor',
            'supervisor_nombre',
            'padrino',
            'padrino_nombre',
            'formador',
            'grupo_comisiones',
            'nivel_estudio',
            'fecha_ingreso',
            'fecha_egreso',
            'fecha_retiro',
            'motivo_egreso',
            'motivo_retiro_gh',
            'motivo_egreso_real',
            'motivo_retiro_operaciones',
            'etapa_induccion',
            'fecha_entrega_area',
            'entregado_por',
            'entregado_por_nombre',
            'dias_para_periodo_prueba',
            'en_periodo_prueba',
            'dias_para_fin_practica',
            'etapa_practica_activa',
            'en_practicas',
            'practica_lectiva_inicio',
            'practica_lectiva_fin',
            'practica_productiva_inicio',
            'practica_productiva_fin',
        ]


class EmpleadoContactoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmpleadoContacto
        fields = [
            'id',
            'correo_corporativo',
            'correo_personal',
            'correo_personal_verificado',
            'celular_corporativo',
            'celular_personal',
            'celular_alterno',
            'telefono_fijo',
            'direccion_residencia',
            'claro_pay',
        ]


class EmpleadoSeguridadSocialSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmpleadoSeguridadSocial
        fields = [
            'id',
            'eps',
            'arl',
            'certificado_arl_url',
            'afp',
            'esquema_vacunacion',
        ]


class EmpleadoCertificacionesSSTSerializer(serializers.ModelSerializer):
    estado_alturas = serializers.ReadOnlyField()
    estado_coordinador = serializers.ReadOnlyField()
    estado_tecnico = serializers.ReadOnlyField()

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        for date_field in ['vencimiento_alturas', 'vencimiento_coordinador', 'vencimiento_tecnico']:
            if date_field in data and data[date_field] in ('', None):
                data[date_field] = None
        for str_field in ['permiso_trabajo', 'certificado_alturas_url', 'certificado_coordinador_url', 'certificado_tecnico_url']:
            if str_field in data and data[str_field] == '':
                data[str_field] = None
        return super().to_internal_value(data)

    class Meta:
        model = EmpleadoCertificacionesSST
        fields = [
            'id',
            'permiso_trabajo',
            'certificado_alturas_url',
            'vencimiento_alturas',
            'estado_alturas',
            'certificado_coordinador_url',
            'vencimiento_coordinador',
            'estado_coordinador',
            'certificado_tecnico_url',
            'vencimiento_tecnico',
            'estado_tecnico',
        ]


class EmpleadoDotacionActivosSerializer(serializers.ModelSerializer):
    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        for date_field in ['fecha_entrega_carnet']:
            if date_field in data and data[date_field] in ('', None):
                data[date_field] = None
        for str_field in [
            'talla_camisa', 'talla_pantalon', 'talla_calzado', 'talla_chaqueta', 'talla_guerrera'
        ]:
            if str_field in data and data[str_field] == '':
                data[str_field] = None
        return super().to_internal_value(data)

    class Meta:
        model = EmpleadoDotacionActivos
        fields = [
            'id',
            'tiene_carnet',
            'fecha_entrega_carnet',
            'talla_camisa',
            'talla_pantalon',
            'talla_calzado',
            'talla_chaqueta',
            'talla_guerrera',
        ]


class EmpleadoDotacionComprobanteSerializer(serializers.ModelSerializer):
    subido_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = EmpleadoDotacionComprobante
        fields = [
            'id',
            'fecha_entrega',
            'observaciones',
            'archivo_url',
            'subido_por',
            'subido_por_nombre',
            'created_at',
        ]

    def get_subido_por_nombre(self, obj):
        if not obj.subido_por:
            return None
        full_name = obj.subido_por.get_full_name()
        return full_name.strip() if full_name and full_name.strip() else obj.subido_por.username


class EmpleadoMovilidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmpleadoMovilidad
        fields = [
            'id',
            'sabe_conducir',
            'medio_transporte',
            'modelo_vehiculo',
            'placa_vehiculo',
        ]


class EmpleadoCuentaBancariaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmpleadoCuentaBancaria
        fields = [
            'id',
            'banco',
            'tipo_cuenta',
            'numero_cuenta',
            'es_nomina',
            'titular',
            'cc_titular',
        ]


class EmpleadoContactoEmergenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmpleadoContactoEmergencia
        fields = [
            'id',
            'nombre_completo',
            'parentesco',
            'telefono',
            'es_principal',
        ]


class EmpleadoPersonaACargoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmpleadoPersonaACargo
        fields = [
            'id',
            'nombre_completo',
            'parentesco',
            'tipo_documento',
            'numero_documento',
            'fecha_nacimiento',
        ]


class EmpleadoDocumentoAdjuntoSerializer(serializers.ModelSerializer):
    tiene_permiso = serializers.SerializerMethodField()
    cargado = serializers.SerializerMethodField()

    class Meta:
        model = EmpleadoDocumentoAdjunto
        fields = [
            'id',
            'tipo_documento',
            'archivo_url',
            'fecha_subida',
            'tiene_permiso',
            'cargado',
        ]

    def _es_documento_sensible(self, instance):
        tipo = (instance.tipo_documento or '').upper()
        return tipo in ['CEDULA_FRONTAL', 'CEDULA_POSTERIOR', 'CEDULA']

    def get_cargado(self, instance):
        return bool(instance.archivo_url)

    def get_tiene_permiso(self, instance):
        if not self._es_documento_sensible(instance):
            return True
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        from apps.empleados.permissions import PuedeVerDocumentoIdentidad
        return PuedeVerDocumentoIdentidad.tiene_acceso(user, instance.empleado)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        tiene_permiso = self.get_tiene_permiso(instance)
        data['tiene_permiso'] = tiene_permiso
        data['cargado'] = self.get_cargado(instance)
        if not tiene_permiso:
            # Enmascarar la URL física directa por política de Habeas Data
            data['archivo_url'] = None
        return data


class EmpleadoAuditoriaLogSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = EmpleadoAuditoriaLog
        fields = [
            'id',
            'usuario',
            'usuario_nombre',
            'accion',
            'tabla_afectada',
            'datos_anteriores',
            'datos_nuevos',
            'ip_origen',
            'created_at',
        ]

    def get_usuario_nombre(self, obj):
        if obj.usuario:
            perfil = getattr(obj.usuario, 'empleado_perfil', None)
            if perfil and getattr(perfil, 'nombre_completo', None):
                return perfil.nombre_completo
            return obj.usuario.get_full_name() or obj.usuario.username
        return 'Sistema'


# Serializer Liviano para Listados (DataGrid Principal)
class EmpleadoPerfilListSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()
    dias_en_empresa = serializers.ReadOnlyField()
    cargo = serializers.CharField(source='laboral.cargo', read_only=True)
    area = serializers.CharField(source='laboral.area', read_only=True)
    carpeta = serializers.CharField(source='laboral.carpeta', read_only=True)
    movil = serializers.CharField(source='laboral.movil', read_only=True)
    sede = serializers.CharField(source='laboral.sede', read_only=True)
    tipo_labor = serializers.CharField(source='laboral.tipo_labor', read_only=True)
    etapa_induccion = serializers.CharField(source='laboral.etapa_induccion', read_only=True)
    fecha_ingreso = serializers.DateField(source='laboral.fecha_ingreso', read_only=True)
    dias_para_periodo_prueba = serializers.IntegerField(source='laboral.dias_para_periodo_prueba', read_only=True)
    en_periodo_prueba = serializers.BooleanField(read_only=True)
    dias_para_fin_practica = serializers.IntegerField(source='laboral.dias_para_fin_practica', read_only=True)
    etapa_practica_activa = serializers.CharField(source='laboral.etapa_practica_activa', read_only=True)
    en_practicas = serializers.BooleanField(source='laboral.en_practicas', read_only=True)
    practica_lectiva_inicio = serializers.DateField(source='laboral.practica_lectiva_inicio', read_only=True)
    practica_lectiva_fin = serializers.DateField(source='laboral.practica_lectiva_fin', read_only=True)
    practica_productiva_inicio = serializers.DateField(source='laboral.practica_productiva_inicio', read_only=True)
    practica_productiva_fin = serializers.DateField(source='laboral.practica_productiva_fin', read_only=True)
    placa_vehiculo = serializers.CharField(source='movilidad.placa_vehiculo', read_only=True)
    estado_alturas = serializers.CharField(source='certificaciones_sst.estado_alturas', read_only=True)

    class Meta:
        model = EmpleadoPerfil
        fields = [
            'id',
            'numero_documento',
            'tipo_documento',
            'nombres',
            'apellidos',
            'nombre_completo',
            'estado',
            'foto_url',
            'cargo',
            'area',
            'carpeta',
            'movil',
            'sede',
            'tipo_labor',
            'etapa_induccion',
            'fecha_ingreso',
            'dias_para_periodo_prueba',
            'en_periodo_prueba',
            'dias_para_fin_practica',
            'etapa_practica_activa',
            'en_practicas',
            'practica_lectiva_inicio',
            'practica_lectiva_fin',
            'practica_productiva_inicio',
            'practica_productiva_fin',
            'dias_en_empresa',
            'placa_vehiculo',
            'estado_alturas',
            'created_at',
        ]


# Serializer Completo para Detalle (Ficha con Pestañas)
def _normalize_audit_val(val):
    if val is None or val == 'None':
        return ''
    if hasattr(val, 'nombre_completo'):
        return str(val.nombre_completo).strip()
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    if isinstance(val, bool):
        return 'SI' if val else 'NO'
    return str(val).strip()


def _compute_audit_diff(antes_dict, nuevos_dict):
    """
    Compara dos estados y devuelve únicamente las claves con diferencias reales,
    evitando registrar datos redundantes o generar logs cuando nada ha cambiado.
    """
    diff_antes = {}
    diff_nuevos = {}
    all_keys = set(antes_dict.keys()) | set(nuevos_dict.keys())
    for k in all_keys:
        v_ant = _normalize_audit_val(antes_dict.get(k))
        v_nue = _normalize_audit_val(nuevos_dict.get(k))
        if v_ant != v_nue:
            diff_antes[k] = v_ant
            diff_nuevos[k] = v_nue
    return diff_antes, diff_nuevos


class EmpleadoPerfilDetailSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    nombre_completo = serializers.ReadOnlyField()
    dias_en_empresa = serializers.ReadOnlyField()
    laboral = EmpleadoLaboralSerializer(required=False)
    contacto = EmpleadoContactoSerializer(required=False)
    seguridad_social = EmpleadoSeguridadSocialSerializer(required=False)
    certificaciones_sst = EmpleadoCertificacionesSSTSerializer(required=False)
    dotacion_activos = EmpleadoDotacionActivosSerializer(required=False)
    movilidad = EmpleadoMovilidadSerializer(required=False)
    cuentas_bancarias = EmpleadoCuentaBancariaSerializer(many=True, read_only=True)
    contactos_emergencia = EmpleadoContactoEmergenciaSerializer(many=True, read_only=True)
    personas_a_cargo = EmpleadoPersonaACargoSerializer(many=True, read_only=True)
    documentos_adjuntos = EmpleadoDocumentoAdjuntoSerializer(many=True, read_only=True)
    comprobantes_dotacion = EmpleadoDotacionComprobanteSerializer(many=True, read_only=True)
    puede_ver_documento_identidad = serializers.SerializerMethodField()

    def get_puede_ver_documento_identidad(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        from apps.empleados.permissions import PuedeVerDocumentoIdentidad
        return PuedeVerDocumentoIdentidad.tiene_acceso(user, obj)

    class Meta:
        model = EmpleadoPerfil
        fields = [
            'id',
            'user',
            'tipo_documento',
            'numero_documento',
            'fecha_expedicion_documento',
            'pasaporte',
            'nombres',
            'apellidos',
            'nombre_completo',
            'dias_en_empresa',
            'fecha_nacimiento',
            'genero',
            'estado_civil',
            'foto_url',
            'estado',
            'datos_adicionales',
            'puede_ver_documento_identidad',
            'laboral',
            'contacto',
            'seguridad_social',
            'certificaciones_sst',
            'dotacion_activos',
            'movilidad',
            'cuentas_bancarias',
            'contactos_emergencia',
            'personas_a_cargo',
            'documentos_adjuntos',
            'comprobantes_dotacion',
            'created_at',
            'updated_at',
        ]

    def update(self, instance, validated_data):
        from django.db import transaction
        with transaction.atomic():
            laboral_data = validated_data.pop('laboral', None)
            contacto_data = validated_data.pop('contacto', None)
            ss_data = validated_data.pop('seguridad_social', None)
            sst_data = validated_data.pop('certificaciones_sst', None)
            dot_data = validated_data.pop('dotacion_activos', None)
            mov_data = validated_data.pop('movilidad', None)

            perfil_antes = {k: getattr(instance, k) for k in validated_data.keys() if hasattr(instance, k)}
            for attr, val in validated_data.items():
                setattr(instance, attr, val)
            instance.save()

            # Auditoría y Trazabilidad Transaccional (Tabla 13: empleados_auditoria_log)
            request = self.context.get('request')
            user = request.user if request and hasattr(request, 'user') and request.user.is_authenticated else None
            ip = request.META.get('REMOTE_ADDR') if request else None

            if user and validated_data:
                from apps.empleados.models import EmpleadoAuditoriaLog
                perfil_nuevos = {k: getattr(instance, k, '') for k in validated_data.keys()}
                diff_antes, diff_nuevos = _compute_audit_diff(perfil_antes, perfil_nuevos)
                if diff_antes:
                    EmpleadoAuditoriaLog.objects.create(
                        empleado=instance,
                        usuario=user,
                        accion='ACTUALIZACION_PERFIL',
                        tabla_afectada='empleados_perfil',
                        datos_anteriores=diff_antes,
                        datos_nuevos=diff_nuevos,
                        ip_origen=ip
                    )

            if laboral_data:
                from apps.empleados.models import EmpleadoLaboral, EmpleadoAuditoriaLog
                from apps.empleados.services import EmpleadoWorkflowService

                lab_instance = getattr(instance, 'laboral', None)
                lab_antes = {}
                if lab_instance:
                    for k in laboral_data.keys():
                        lab_antes[k] = getattr(lab_instance, k, None)

                movil_ant = getattr(lab_instance, 'movil', None) if lab_instance else None
                supervisor_ant = getattr(lab_instance, 'supervisor_id', None) if lab_instance else None
                area_ant = getattr(lab_instance, 'area', None) if lab_instance else None
                carpeta_ant = getattr(lab_instance, 'carpeta', None) if lab_instance else None

                lab_obj, _ = EmpleadoLaboral.objects.update_or_create(empleado=instance, defaults=laboral_data)

                cargo_actual = (lab_obj.cargo or '').upper()
                is_auxiliar = 'AUXILIAR' in cargo_actual
                is_tecnico = 'TECNICO' in cargo_actual

                # Regla Legacy 2.6: Auto-herencia de cuadrilla para Auxiliar al ser asignado a cuadrilla activa
                if is_auxiliar:
                    if lab_obj.movil and "ASIGNAR" not in lab_obj.movil.upper() and "FUERA DE OPERACION" not in lab_obj.movil.upper():
                        try:
                            EmpleadoWorkflowService.sincronizar_herencia_auxiliar_desde_tecnico(
                                auxiliar_perfil=instance,
                                user_operator=user,
                                ip_address=ip
                            )
                            lab_obj.refresh_from_db()
                        except Exception:
                            pass
                elif is_tecnico:
                    cambio_movil = movil_ant != lab_obj.movil
                    cambio_datos = (
                        supervisor_ant != lab_obj.supervisor_id or
                        area_ant != lab_obj.area or
                        carpeta_ant != lab_obj.carpeta
                    )
                    if cambio_movil or cambio_datos:
                        try:
                            EmpleadoWorkflowService.sincronizar_cuadrilla_tecnico_auxiliar(
                                tecnico_perfil=instance,
                                nueva_movil=lab_obj.movil or '',
                                movil_anterior=movil_ant,
                                user_operator=user,
                                ip_address=ip
                            )
                        except Exception:
                            pass

                if user:
                    lab_nuevos = {k: getattr(lab_obj, k, None) for k in laboral_data.keys()}
                    diff_antes, diff_nuevos = _compute_audit_diff(lab_antes, lab_nuevos)
                    if diff_antes:
                        EmpleadoAuditoriaLog.objects.create(
                            empleado=instance,
                            usuario=user,
                            accion='ACTUALIZACION_LABORAL',
                            tabla_afectada='empleados_laboral',
                            datos_anteriores=diff_antes,
                            datos_nuevos=diff_nuevos,
                            ip_origen=ip
                        )

            if contacto_data:
                from apps.empleados.models import EmpleadoContacto, EmpleadoAuditoriaLog
                con_instance = getattr(instance, 'contacto', None)
                con_antes = {}
                if con_instance:
                    for k in contacto_data.keys():
                        con_antes[k] = getattr(con_instance, k, None)

                con_obj, _ = EmpleadoContacto.objects.update_or_create(empleado=instance, defaults=contacto_data)

                if user:
                    con_nuevos = {k: getattr(con_obj, k, None) for k in contacto_data.keys()}
                    diff_antes, diff_nuevos = _compute_audit_diff(con_antes, con_nuevos)
                    if diff_antes:
                        EmpleadoAuditoriaLog.objects.create(
                            empleado=instance,
                            usuario=user,
                            accion='ACTUALIZACION_CONTACTO',
                            tabla_afectada='empleados_contacto',
                            datos_anteriores=diff_antes,
                            datos_nuevos=diff_nuevos,
                            ip_origen=ip
                        )

            if ss_data:
                from apps.empleados.models import EmpleadoSeguridadSocial, EmpleadoAuditoriaLog
                ss_instance = getattr(instance, 'seguridad_social', None)
                ss_antes = {}
                if ss_instance:
                    for k in ss_data.keys():
                        ss_antes[k] = getattr(ss_instance, k, None)

                ss_obj, _ = EmpleadoSeguridadSocial.objects.update_or_create(empleado=instance, defaults=ss_data)

                if user:
                    ss_nuevos = {k: getattr(ss_obj, k, None) for k in ss_data.keys()}
                    diff_antes, diff_nuevos = _compute_audit_diff(ss_antes, ss_nuevos)
                    if diff_antes:
                        EmpleadoAuditoriaLog.objects.create(
                            empleado=instance,
                            usuario=user,
                            accion='ACTUALIZACION_SEGURIDAD_SOCIAL',
                            tabla_afectada='empleados_seguridad_social',
                            datos_anteriores=diff_antes,
                            datos_nuevos=diff_nuevos,
                            ip_origen=ip
                        )

            if sst_data:
                from apps.empleados.models import EmpleadoCertificacionesSST, EmpleadoAuditoriaLog
                sst_instance = getattr(instance, 'certificaciones_sst', None)
                sst_antes = {}
                if sst_instance:
                    for k in sst_data.keys():
                        sst_antes[k] = getattr(sst_instance, k, None)

                sst_obj, _ = EmpleadoCertificacionesSST.objects.update_or_create(empleado=instance, defaults=sst_data)

                if user:
                    sst_nuevos = {k: getattr(sst_obj, k, None) for k in sst_data.keys()}
                    diff_antes, diff_nuevos = _compute_audit_diff(sst_antes, sst_nuevos)
                    if diff_antes:
                        EmpleadoAuditoriaLog.objects.create(
                            empleado=instance,
                            usuario=user,
                            accion='ACTUALIZACION_SST',
                            tabla_afectada='empleados_certificaciones_sst',
                            datos_anteriores=diff_antes,
                            datos_nuevos=diff_nuevos,
                            ip_origen=ip
                        )

            if dot_data:
                from apps.empleados.models import EmpleadoDotacionActivos, EmpleadoAuditoriaLog
                dot_instance = getattr(instance, 'dotacion_activos', None)
                dot_antes = {}
                if dot_instance:
                    for k in dot_data.keys():
                        dot_antes[k] = getattr(dot_instance, k, None)

                dot_obj, _ = EmpleadoDotacionActivos.objects.update_or_create(empleado=instance, defaults=dot_data)

                if user:
                    dot_nuevos = {k: getattr(dot_obj, k, None) for k in dot_data.keys()}
                    diff_antes, diff_nuevos = _compute_audit_diff(dot_antes, dot_nuevos)
                    if diff_antes:
                        EmpleadoAuditoriaLog.objects.create(
                            empleado=instance,
                            usuario=user,
                            accion='ACTUALIZACION_DOTACION',
                            tabla_afectada='empleados_dotacion_activos',
                            datos_anteriores=diff_antes,
                            datos_nuevos=diff_nuevos,
                            ip_origen=ip
                        )

            if mov_data:
                from apps.empleados.models import EmpleadoMovilidad, EmpleadoAuditoriaLog
                mov_instance = getattr(instance, 'movilidad', None)
                mov_antes = {}
                if mov_instance:
                    for k in mov_data.keys():
                        mov_antes[k] = getattr(mov_instance, k, None)

                new_placa = mov_data.get('placa_vehiculo')
                if new_placa:
                    new_placa = new_placa.strip().upper()
                    mov_data['placa_vehiculo'] = new_placa
                    # Regla de exclusividad atómica: desasignar de quien la tuviera
                    otros_con_placa = EmpleadoMovilidad.objects.filter(placa_vehiculo=new_placa).exclude(empleado=instance)
                    for otro in otros_con_placa:
                        otro_perfil = otro.empleado
                        otro.placa_vehiculo = None
                        otro.save(update_fields=['placa_vehiculo'])
                        if user:
                            EmpleadoAuditoriaLog.objects.create(
                                empleado=otro_perfil,
                                usuario=user,
                                accion='LIBERACION_PLACA',
                                tabla_afectada='empleados_movilidad',
                                datos_anteriores={'placa_vehiculo': new_placa},
                                datos_nuevos={'placa_vehiculo': ''},
                                ip_origen=ip
                            )

                mov_obj, _ = EmpleadoMovilidad.objects.update_or_create(empleado=instance, defaults=mov_data)

                if user:
                    mov_nuevos = {k: getattr(mov_obj, k, None) for k in mov_data.keys()}
                    diff_antes, diff_nuevos = _compute_audit_diff(mov_antes, mov_nuevos)
                    if diff_antes:
                        EmpleadoAuditoriaLog.objects.create(
                            empleado=instance,
                            usuario=user,
                            accion='ACTUALIZACION_MOVILIDAD',
                            tabla_afectada='empleados_movilidad',
                            datos_anteriores=diff_antes,
                            datos_nuevos=diff_nuevos,
                            ip_origen=ip
                        )

            return instance


# Serializadores para Acciones de Workflow
class EntregaGHSerializer(serializers.Serializer):
    supervisor_recibe_id = serializers.IntegerField(
        required=True,
        help_text="ID del EmpleadoPerfil del supervisor o líder que recibe al colaborador"
    )


class AsignarPlacaSerializer(serializers.Serializer):
    placa = serializers.CharField(
        required=True,
        max_length=20,
        help_text="Placa del vehículo a asignar"
    )
    sabe_conducir = serializers.BooleanField(required=False, default=False)
    conduce = serializers.BooleanField(required=False, default=False)
    medio_transporte = serializers.CharField(default='NINGUNO', max_length=50, required=False, allow_blank=True)
    modelo_vehiculo = serializers.CharField(default='', max_length=100, required=False, allow_blank=True)


class DesactivarEmpleadoSerializer(serializers.Serializer):
    fecha_egreso = serializers.DateField(required=False, allow_null=True)
    fecha_retiro = serializers.DateField(required=False, allow_null=True)
    motivo = serializers.CharField(required=False, max_length=150, allow_blank=True)
    motivo_retiro_gh = serializers.CharField(required=False, max_length=150, allow_blank=True)
    motivo_real = serializers.CharField(required=False, default='', max_length=255, allow_blank=True)
    motivo_retiro_operaciones = serializers.CharField(required=False, max_length=255, allow_blank=True)

    def validate(self, attrs):
        fecha = attrs.get('fecha_egreso') or attrs.get('fecha_retiro')
        if not fecha:
            from django.utils import timezone
            fecha = timezone.now().date()
        attrs['fecha_egreso'] = fecha

        motivo = attrs.get('motivo') or attrs.get('motivo_retiro_gh')
        if not motivo:
            raise serializers.ValidationError({'motivo': 'El motivo de retiro es obligatorio.'})
        attrs['motivo'] = motivo

        motivo_real = attrs.get('motivo_real') or attrs.get('motivo_retiro_operaciones') or ''
        attrs['motivo_real'] = motivo_real
        return attrs


class ReactivarEmpleadoSerializer(serializers.Serializer):
    movil_inicial = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=50, default=None)
    observaciones = serializers.CharField(required=False, allow_blank=True, default='')


class GestionarContactoEmergenciaSerializer(serializers.Serializer):
    contacto_id = serializers.IntegerField(required=False, allow_null=True)
    nombre_completo = serializers.CharField(max_length=150, required=True)
    parentesco = serializers.CharField(max_length=50, required=True)
    telefono = serializers.CharField(max_length=50, required=True)
    es_principal = serializers.BooleanField(required=False, default=False)


class GestionarCuentaBancariaSerializer(serializers.Serializer):
    banco = serializers.CharField(required=True, max_length=100)
    numero_cuenta = serializers.CharField(required=True, max_length=50)
    tipo_cuenta = serializers.ChoiceField(choices=['AHORROS', 'CORRIENTE'], default='AHORROS')
    es_nomina = serializers.BooleanField(default=True)
    titular = serializers.CharField(default='', max_length=150, allow_blank=True)
    cc_titular = serializers.CharField(default='', max_length=50, allow_blank=True)
    cuenta_id = serializers.IntegerField(required=False, allow_null=True)

class GestionarPersonaACargoSerializer(serializers.Serializer):
    persona_id = serializers.IntegerField(required=False, allow_null=True)
    nombre_completo = serializers.CharField(max_length=150, required=True)
    parentesco = serializers.CharField(max_length=50, required=True)
    tipo_documento = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)
    numero_documento = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)
    fecha_nacimiento = serializers.DateField(required=False, allow_null=True)

