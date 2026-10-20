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
    dias_para_periodo_prueba = serializers.ReadOnlyField()

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
        return super().to_internal_value(data)

    class Meta:
        model = EmpleadoLaboral
        fields = [
            'id',
            'codigo_sap',
            'sede',
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
            'motivo_egreso',
            'motivo_egreso_real',
            'etapa_induccion',
            'fecha_entrega_area',
            'entregado_por',
            'entregado_por_nombre',
            'dias_para_periodo_prueba',
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
    estado_tecnico = serializers.ReadOnlyField()

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        for date_field in ['vencimiento_alturas', 'vencimiento_tecnico']:
            if date_field in data and data[date_field] in ('', None):
                data[date_field] = None
        for str_field in ['permiso_trabajo', 'certificado_alturas_url', 'certificado_tecnico_url']:
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
    subido_por_nombre = serializers.ReadOnlyField(source='subido_por.get_full_name')

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
    class Meta:
        model = EmpleadoDocumentoAdjunto
        fields = [
            'id',
            'tipo_documento',
            'archivo_url',
            'fecha_subida',
        ]


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
            'dias_en_empresa',
            'placa_vehiculo',
            'estado_alturas',
            'created_at',
        ]


# Serializer Completo para Detalle (Ficha con Pestañas)
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
                EmpleadoAuditoriaLog.objects.create(
                    empleado=instance,
                    usuario=user,
                    accion='ACTUALIZACION_PERFIL',
                    tabla_afectada='empleados_perfil',
                    datos_anteriores={k: str(v) for k, v in perfil_antes.items()},
                    datos_nuevos={k: str(getattr(instance, k, '')) for k in validated_data.keys()},
                    ip_origen=ip
                )

            if laboral_data:
                from apps.empleados.models import EmpleadoLaboral, EmpleadoAuditoriaLog
                from apps.empleados.services import EmpleadoWorkflowService

                lab_instance = getattr(instance, 'laboral', None)
                lab_antes = {}
                if lab_instance:
                    for k in laboral_data.keys():
                        val = getattr(lab_instance, k, None)
                        lab_antes[k] = val.id if hasattr(val, 'id') else val

                lab_obj, _ = EmpleadoLaboral.objects.update_or_create(empleado=instance, defaults=laboral_data)

                # Si es técnico y cambió de móvil, sincronizar cuadrilla (Regla PHP legacy)
                if lab_antes.get('movil') != lab_obj.movil and lab_obj.cargo == 'TECNICO':
                    try:
                        EmpleadoWorkflowService.sincronizar_cuadrilla_tecnico_auxiliar(
                            tecnico_perfil=instance,
                            nueva_movil=lab_obj.movil or '',
                            user_operator=user,
                            ip_address=ip
                        )
                    except Exception:
                        pass

                if user:
                    datos_nuevos_dict = {}
                    for k in laboral_data.keys():
                        val = getattr(lab_obj, k, None)
                        datos_nuevos_dict[k] = val.id if hasattr(val, 'id') else val
                    EmpleadoAuditoriaLog.objects.create(
                        empleado=instance,
                        usuario=user,
                        accion='ACTUALIZACION_LABORAL',
                        tabla_afectada='empleados_laboral',
                        datos_anteriores={k: str(v) for k, v in lab_antes.items()},
                        datos_nuevos={k: str(v) for k, v in datos_nuevos_dict.items()},
                        ip_origen=ip
                    )
            if contacto_data:
                from apps.empleados.models import EmpleadoContacto, EmpleadoAuditoriaLog
                con_instance = getattr(instance, 'contacto', None)
                con_antes = {}
                if con_instance:
                    for k in contacto_data.keys():
                        val = getattr(con_instance, k, None)
                        con_antes[k] = str(val) if val is not None else ''

                con_obj, _ = EmpleadoContacto.objects.update_or_create(empleado=instance, defaults=contacto_data)

                if user:
                    datos_nuevos_dict = {k: str(getattr(con_obj, k, '')) for k in contacto_data.keys()}
                    EmpleadoAuditoriaLog.objects.create(
                        empleado=instance,
                        usuario=user,
                        accion='ACTUALIZACION_CONTACTO',
                        tabla_afectada='empleados_contacto',
                        datos_anteriores=con_antes,
                        datos_nuevos=datos_nuevos_dict,
                        ip_origen=ip
                    )
            if ss_data:
                from apps.empleados.models import EmpleadoSeguridadSocial
                EmpleadoSeguridadSocial.objects.update_or_create(empleado=instance, defaults=ss_data)
            if sst_data:
                from apps.empleados.models import EmpleadoCertificacionesSST, EmpleadoAuditoriaLog
                sst_instance = getattr(instance, 'certificaciones_sst', None)
                sst_antes = {}
                if sst_instance:
                    for k in sst_data.keys():
                        val = getattr(sst_instance, k, None)
                        sst_antes[k] = str(val) if val is not None else ''

                sst_obj, _ = EmpleadoCertificacionesSST.objects.update_or_create(empleado=instance, defaults=sst_data)

                if user:
                    datos_nuevos_dict = {k: str(getattr(sst_obj, k, '')) for k in sst_data.keys()}
                    EmpleadoAuditoriaLog.objects.create(
                        empleado=instance,
                        usuario=user,
                        accion='ACTUALIZACION_SST',
                        tabla_afectada='empleados_certificaciones_sst',
                        datos_anteriores=sst_antes,
                        datos_nuevos=datos_nuevos_dict,
                        ip_origen=ip
                    )
            if dot_data:
                from apps.empleados.models import EmpleadoDotacionActivos, EmpleadoAuditoriaLog
                dot_instance = getattr(instance, 'dotacion_activos', None)
                dot_antes = {}
                if dot_instance:
                    for k in dot_data.keys():
                        val = getattr(dot_instance, k, None)
                        dot_antes[k] = str(val) if val is not None else ''

                dot_obj, _ = EmpleadoDotacionActivos.objects.update_or_create(empleado=instance, defaults=dot_data)

                if user:
                    datos_nuevos_dict = {k: str(getattr(dot_obj, k, '')) for k in dot_data.keys()}
                    EmpleadoAuditoriaLog.objects.create(
                        empleado=instance,
                        usuario=user,
                        accion='ACTUALIZACION_DOTACION',
                        tabla_afectada='empleados_dotacion_activos',
                        datos_anteriores=dot_antes,
                        datos_nuevos=datos_nuevos_dict,
                        ip_origen=ip
                    )
            if mov_data:
                from apps.empleados.models import EmpleadoMovilidad, EmpleadoAuditoriaLog
                mov_instance = getattr(instance, 'movilidad', None)
                mov_antes = {}
                if mov_instance:
                    for k in mov_data.keys():
                        val = getattr(mov_instance, k, None)
                        mov_antes[k] = str(val) if val is not None else ''

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
                                datos_nuevos={'placa_vehiculo': None},
                                ip_origen=ip
                            )

                mov_obj, _ = EmpleadoMovilidad.objects.update_or_create(empleado=instance, defaults=mov_data)

                if user:
                    datos_nuevos_dict = {k: str(getattr(mov_obj, k, '')) for k in mov_data.keys()}
                    EmpleadoAuditoriaLog.objects.create(
                        empleado=instance,
                        usuario=user,
                        accion='ACTUALIZACION_MOVILIDAD',
                        tabla_afectada='empleados_movilidad',
                        datos_anteriores=mov_antes,
                        datos_nuevos=datos_nuevos_dict,
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
    fecha_egreso = serializers.DateField(required=True)
    motivo = serializers.CharField(required=True, max_length=150)
    motivo_real = serializers.CharField(default='', max_length=255, allow_blank=True)


class ReactivarEmpleadoSerializer(serializers.Serializer):
    movil_inicial = serializers.CharField(default='1 - SIN ASIGNAR', max_length=50)


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
