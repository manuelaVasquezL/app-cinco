from django.db import models
from .perfil_model import EmpleadoPerfil


class EmpleadoContactoEmergencia(models.Model):
    id = models.BigAutoField(primary_key=True)
    empleado = models.ForeignKey(EmpleadoPerfil, on_delete=models.CASCADE, related_name='contactos_emergencia')
    nombre_completo = models.CharField(max_length=150)
    parentesco = models.CharField(max_length=50)
    telefono = models.CharField(max_length=50)
    es_principal = models.BooleanField(default=False)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_contactos_emergencia'

    def __str__(self):
        return f"Emergencia: {self.nombre_completo} ({self.parentesco})"


class EmpleadoPersonaACargo(models.Model):
    id = models.BigAutoField(primary_key=True)
    empleado = models.ForeignKey(EmpleadoPerfil, on_delete=models.CASCADE, related_name='personas_a_cargo')
    nombre_completo = models.CharField(max_length=150)
    parentesco = models.CharField(max_length=50)
    tipo_documento = models.CharField(max_length=10, blank=True, null=True)
    numero_documento = models.CharField(max_length=50, blank=True, null=True)
    fecha_nacimiento = models.DateField(blank=True, null=True)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_personas_a_cargo'

    def __str__(self):
        return f"Beneficiario: {self.nombre_completo} ({self.parentesco})"
