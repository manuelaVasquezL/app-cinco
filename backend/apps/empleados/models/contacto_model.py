from django.db import models
from .perfil_model import EmpleadoPerfil


class EmpleadoContacto(models.Model):
    id = models.BigAutoField(primary_key=True)
    empleado = models.OneToOneField(EmpleadoPerfil, on_delete=models.CASCADE, related_name='contacto')
    correo_corporativo = models.EmailField(max_length=150, blank=True, null=True)
    correo_personal = models.EmailField(max_length=150, blank=True, null=True)
    correo_personal_verificado = models.BooleanField(default=False)
    celular_corporativo = models.CharField(max_length=50, blank=True, null=True)
    celular_personal = models.CharField(max_length=50, blank=True, null=True)
    celular_alterno = models.CharField(max_length=50, blank=True, null=True)
    telefono_fijo = models.CharField(max_length=50, blank=True, null=True)
    direccion_residencia = models.CharField(max_length=255, blank=True, null=True)
    claro_pay = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_contacto'

    def __str__(self):
        return f"Contacto: {self.empleado.numero_documento}"
