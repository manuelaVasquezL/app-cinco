from django.db import models
from .perfil_model import EmpleadoPerfil


class EmpleadoMovilidad(models.Model):
    id = models.BigAutoField(primary_key=True)
    empleado = models.OneToOneField(EmpleadoPerfil, on_delete=models.CASCADE, related_name='movilidad')
    sabe_conducir = models.BooleanField(default=False)
    medio_transporte = models.CharField(max_length=50, blank=True, null=True)
    modelo_vehiculo = models.CharField(max_length=100, blank=True, null=True)
    placa_vehiculo = models.CharField(max_length=20, blank=True, null=True, db_index=True)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_movilidad'

    def __str__(self):
        return f"Movilidad: {self.empleado.numero_documento} - {self.placa_vehiculo or 'Sin Placa'}"
