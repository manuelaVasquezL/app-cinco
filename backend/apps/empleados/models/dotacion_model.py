from django.db import models
from django.contrib.auth import get_user_model
from .perfil_model import EmpleadoPerfil

User = get_user_model()


class EmpleadoDotacionActivos(models.Model):
    id = models.BigAutoField(primary_key=True)
    empleado = models.OneToOneField(EmpleadoPerfil, on_delete=models.CASCADE, related_name='dotacion_activos')
    tiene_carnet = models.BooleanField(default=False)
    fecha_entrega_carnet = models.DateField(blank=True, null=True)
    talla_camisa = models.CharField(max_length=10, blank=True, null=True)
    talla_pantalon = models.CharField(max_length=10, blank=True, null=True)
    talla_calzado = models.CharField(max_length=10, blank=True, null=True)
    talla_chaqueta = models.CharField(max_length=10, blank=True, null=True)
    talla_guerrera = models.CharField(max_length=10, blank=True, null=True)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_dotacion_activos'

    def __str__(self):
        return f"Dotacion: {self.empleado.numero_documento}"


class EmpleadoDotacionComprobante(models.Model):
    id = models.BigAutoField(primary_key=True)
    empleado = models.ForeignKey(EmpleadoPerfil, on_delete=models.CASCADE, related_name='comprobantes_dotacion')
    fecha_entrega = models.DateField()
    observaciones = models.CharField(max_length=255, blank=True, null=True)
    archivo_url = models.CharField(max_length=255)
    subido_por = models.ForeignKey(User, on_delete=models.PROTECT, related_name='comprobantes_dotacion_subidos')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_dotacion_comprobantes'

    def __str__(self):
        return f"Comprobante Dotacion: {self.empleado.numero_documento} - {self.fecha_entrega}"
