from django.db import models
from django.contrib.auth import get_user_model
from .perfil_model import EmpleadoPerfil

User = get_user_model()


class EmpleadoAuditoriaLog(models.Model):
    id = models.BigAutoField(primary_key=True)
    empleado = models.ForeignKey(EmpleadoPerfil, on_delete=models.CASCADE, related_name='logs')
    usuario = models.ForeignKey(User, on_delete=models.PROTECT, related_name='empleados_modificados')
    accion = models.CharField(max_length=50)
    tabla_afectada = models.CharField(max_length=100)
    datos_anteriores = models.JSONField(blank=True, null=True)
    datos_nuevos = models.JSONField(blank=True, null=True)
    ip_origen = models.GenericIPAddressField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_auditoria_log'
        indexes = [
            models.Index(fields=['empleado', 'created_at']),
        ]

    def __str__(self):
        return f"Log: {self.accion} on {self.tabla_afectada} by User #{self.usuario_id}"
