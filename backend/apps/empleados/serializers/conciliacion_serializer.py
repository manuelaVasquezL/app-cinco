from rest_framework import serializers
from apps.empleados.models import (
    EmpleadoSSFF,
    EmpleadoSIIGO,
    EmpleadoBaseSSFF,
    EmpleadoBaseSIIGO,
)


class EmpleadoSSFFSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()
    vinculado_en_personal = serializers.SerializerMethodField()
    cargo_en_personal = serializers.SerializerMethodField()
    actualizado_por_username = serializers.CharField(source='actualizado_por.username', read_only=True, default=None)
    edit = serializers.ReadOnlyField()
    fecha_edit = serializers.ReadOnlyField()

    class Meta:
        model = EmpleadoSSFF
        fields = [
            'id',
            'empleado_id',
            'cedula',
            'nombres',
            'apellidos',
            'nombre_completo',
            'estado',
            'userid',
            'datos',
            'created_at',
            'updated_at',
            'actualizado_por_id',
            'actualizado_por_username',
            'edit',
            'fecha_edit',
            'vinculado_en_personal',
            'cargo_en_personal',
        ]

    def get_vinculado_en_personal(self, obj):
        return obj.empleado_id is not None

    def get_cargo_en_personal(self, obj):
        if obj.empleado and hasattr(obj.empleado, 'laboral') and obj.empleado.laboral:
            return obj.empleado.laboral.cargo
        return None


class EmpleadoSIIGOSerializer(serializers.ModelSerializer):
    vinculado_en_personal = serializers.SerializerMethodField()
    cargo_en_personal = serializers.SerializerMethodField()
    actualizado_por_username = serializers.CharField(source='actualizado_por.username', read_only=True, default=None)
    edit = serializers.ReadOnlyField()
    fecha_edit = serializers.ReadOnlyField()

    class Meta:
        model = EmpleadoSIIGO
        fields = [
            'id',
            'empleado_id',
            'cedula',
            'nombre_empleado',
            'estado',
            'centro_costo',
            'salario',
            'datos',
            'created_at',
            'updated_at',
            'actualizado_por_id',
            'actualizado_por_username',
            'edit',
            'fecha_edit',
            'vinculado_en_personal',
            'cargo_en_personal',
        ]

    def get_vinculado_en_personal(self, obj):
        return obj.empleado_id is not None

    def get_cargo_en_personal(self, obj):
        if obj.empleado and hasattr(obj.empleado, 'laboral') and obj.empleado.laboral:
            return obj.empleado.laboral.cargo
        return None


# Aliases de compatibilidad
EmpleadoBaseSSFFSerializer = EmpleadoSSFFSerializer
EmpleadoBaseSIIGOSerializer = EmpleadoSIIGOSerializer
