import re
from decimal import Decimal
from rest_framework import serializers
from apps.implementacion_fo.models import MappingPredio


def clean_uppercase(value):
    """Limpia espacios extras y convierte a mayúsculas."""
    if isinstance(value, str):
        return re.sub(r"\s+", " ", value).strip().upper()
    return value


def parse_coordenada(value):
    """
    Convierte coordenada en string (soporta comas o puntos, ej: '6,308625' o '6.308625')
    a un objeto Decimal válido.
    """
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    if isinstance(value, str):
        cleaned = value.strip().replace(",", ".")
        try:
            return Decimal(cleaned)
        except Exception:
            return None
    return value


class MappingPredioReadSerializer(serializers.ModelSerializer):
    """Serializer para lectura de predios con campos calculados y auditoría."""

    total_unidades = serializers.ReadOnlyField()
    direccion_completa = serializers.ReadOnlyField()
    created_by_nombre = serializers.SerializerMethodField()

    class Meta:
        model = MappingPredio
        fields = [
            "id",
            "nombre_conjunto",
            "nombre_calle",
            "placa_unidad",
            "barrio",
            "interior",
            "num_casas",
            "num_apartamentos",
            "num_locales",
            "num_pisos",
            "calle_alterna_2",
            "placa_alterna_2",
            "calle_alterna_3",
            "placa_alterna_3",
            "distribucion",
            "lote_amp",
            "latitud",
            "longitud",
            "observaciones",
            "total_unidades",
            "direccion_completa",
            "sp_synced",
            "sp_synced_at",
            "sp_sync_error",
            "created_at",
            "created_by",
            "created_by_nombre",
            "updated_at",
        ]

    def get_created_by_nombre(self, obj):
        if obj.created_by:
            first = getattr(obj.created_by, "first_name", "")
            last = getattr(obj.created_by, "last_name", "")
            name = f"{first} {last}".strip()
            return name or getattr(obj.created_by, "username", str(obj.created_by.id))
        return "Sistema"


class MappingPredioWriteSerializer(serializers.ModelSerializer):
    """
    Serializer para escritura ágil de predios.
    Aplica normalización automática (mayúsculas, formato de coordenadas con coma o punto).
    No contiene validaciones bloqueantes de unicidad para evitar reprocesos.
    """

    class Meta:
        model = MappingPredio
        fields = [
            "nombre_conjunto",
            "nombre_calle",
            "placa_unidad",
            "barrio",
            "interior",
            "num_casas",
            "num_apartamentos",
            "num_locales",
            "num_pisos",
            "calle_alterna_2",
            "placa_alterna_2",
            "calle_alterna_3",
            "placa_alterna_3",
            "distribucion",
            "lote_amp",
            "latitud",
            "longitud",
            "observaciones",
        ]

    def validate_nombre_conjunto(self, value):
        return clean_uppercase(value)

    def validate_nombre_calle(self, value):
        return clean_uppercase(value)

    def validate_placa_unidad(self, value):
        return clean_uppercase(value)

    def validate_barrio(self, value):
        return clean_uppercase(value)

    def validate_interior(self, value):
        return clean_uppercase(value)

    def validate_calle_alterna_2(self, value):
        return clean_uppercase(value)

    def validate_placa_alterna_2(self, value):
        return clean_uppercase(value)

    def validate_calle_alterna_3(self, value):
        return clean_uppercase(value)

    def validate_placa_alterna_3(self, value):
        return clean_uppercase(value)

    def validate_lote_amp(self, value):
        return clean_uppercase(value)

    def validate_distribucion(self, value):
        return clean_uppercase(value)

    def to_internal_value(self, data):
        # Sanitizar coordenadas antes de que DRF valide el DecimalField
        data_copy = data.copy() if hasattr(data, "copy") else dict(data)
        if "latitud" in data_copy:
            data_copy["latitud"] = parse_coordenada(data_copy.get("latitud"))
        if "longitud" in data_copy:
            data_copy["longitud"] = parse_coordenada(data_copy.get("longitud"))
        # Si vienen los nombres del excel CORDX / CORDY
        if "CORDX" in data_copy and not data_copy.get("latitud"):
            data_copy["latitud"] = parse_coordenada(data_copy.get("CORDX"))
        if "CORDY" in data_copy and not data_copy.get("longitud"):
            data_copy["longitud"] = parse_coordenada(data_copy.get("CORDY"))
        return super().to_internal_value(data_copy)


class CuadraCheckResponseSerializer(serializers.Serializer):
    """Respuesta para alerta temprana de cuadra o plancha existente."""
    tiene_registros = serializers.BooleanField()
    total_predios = serializers.IntegerField()
    ultimo_registro_fecha = serializers.DateTimeField(allow_null=True)
    ultimo_recolector = serializers.CharField(allow_null=True, allow_blank=True)
    mensaje = serializers.CharField()
    predios_recientes = MappingPredioReadSerializer(many=True, read_only=True)


class DireccionCheckResponseSerializer(serializers.Serializer):
    """Respuesta para advertencia no bloqueante de dirección similar o existente."""
    existe_exacta = serializers.BooleanField()
    total_coincidencias = serializers.IntegerField()
    coincidencias = MappingPredioReadSerializer(many=True, read_only=True)
    mensaje = serializers.CharField(allow_null=True, allow_blank=True)
