from django.db import models
from .perfil_model import EmpleadoPerfil


class EmpleadoSeguridadSocial(models.Model):
    id = models.BigAutoField(primary_key=True)
    empleado = models.OneToOneField(EmpleadoPerfil, on_delete=models.CASCADE, related_name='seguridad_social')
    eps = models.CharField(max_length=100, blank=True, null=True)
    arl = models.CharField(max_length=100, blank=True, null=True, default='COLMENA')
    certificado_arl_url = models.CharField(max_length=255, blank=True, null=True)
    afp = models.CharField(max_length=100, blank=True, null=True)
    esquema_vacunacion = models.JSONField(blank=True, null=True)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_seguridad_social'

    def __str__(self):
        return f"Seguridad Social: {self.empleado.numero_documento}"
