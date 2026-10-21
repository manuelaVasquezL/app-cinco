from django.contrib import admin
from .models import MappingPredio


@admin.register(MappingPredio)
class MappingPredioAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "nombre_calle",
        "placa_unidad",
        "nombre_conjunto",
        "barrio",
        "lote_amp",
        "total_unidades",
        "created_at",
        "created_by",
    )
    list_filter = ("barrio", "lote_amp", "is_deleted")
    search_fields = (
        "nombre_calle",
        "placa_unidad",
        "nombre_conjunto",
        "barrio",
        "lote_amp",
    )
    readonly_fields = ("created_at", "updated_at", "deleted_at")
