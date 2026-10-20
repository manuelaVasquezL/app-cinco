from django.db import models
from .perfil_model import EmpleadoPerfil


class EmpleadoDocumentoAdjunto(models.Model):
    id = models.BigAutoField(primary_key=True)
    empleado = models.ForeignKey(EmpleadoPerfil, on_delete=models.CASCADE, related_name='documentos_adjuntos')
    tipo_documento = models.CharField(max_length=50)
    archivo_url = models.CharField(max_length=255)
    fecha_subida = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_documentos_adjuntos'

    def __str__(self):
        return f"Documento {self.tipo_documento}: {self.empleado.numero_documento}"
