from django.db import models
from django.utils import timezone
from .perfil_model import EmpleadoPerfil


class EmpleadoCertificacionesSST(models.Model):
    id = models.BigAutoField(primary_key=True)
    empleado = models.OneToOneField(EmpleadoPerfil, on_delete=models.CASCADE, related_name='certificaciones_sst')
    permiso_trabajo = models.CharField(max_length=100, blank=True, null=True)
    certificado_alturas_url = models.CharField(max_length=255, blank=True, null=True)
    vencimiento_alturas = models.DateField(blank=True, null=True)
    certificado_tecnico_url = models.CharField(max_length=255, blank=True, null=True)
    vencimiento_tecnico = models.DateField(blank=True, null=True)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_certificaciones_sst'

    def __str__(self):
        return f"SST: {self.empleado.numero_documento}"

    @property
    def estado_alturas(self):
        if not self.vencimiento_alturas:
            return 'NO_APLICA'
        hoy = timezone.now().date()
        if self.vencimiento_alturas < hoy:
            return 'VENCIDO'
        dias_restantes = (self.vencimiento_alturas - hoy).days
        return 'POR_VENCER' if dias_restantes <= 30 else 'VIGENTE'

    @property
    def estado_tecnico(self):
        if not self.vencimiento_tecnico:
            return 'NO_APLICA'
        hoy = timezone.now().date()
        if self.vencimiento_tecnico < hoy:
            return 'VENCIDO'
        dias_restantes = (self.vencimiento_tecnico - hoy).days
        return 'POR_VENCER' if dias_restantes <= 30 else 'VIGENTE'
