from django.db import models
from .perfil_model import EmpleadoPerfil


class EmpleadoCuentaBancaria(models.Model):
    TIPO_CUENTA_CHOICES = [
        ('AHORROS', 'Ahorros'),
        ('CORRIENTE', 'Corriente'),
    ]

    id = models.BigAutoField(primary_key=True)
    empleado = models.ForeignKey(EmpleadoPerfil, on_delete=models.CASCADE, related_name='cuentas_bancarias')
    banco = models.CharField(max_length=100)
    tipo_cuenta = models.CharField(max_length=50, choices=TIPO_CUENTA_CHOICES, default='AHORROS')
    numero_cuenta = models.CharField(max_length=50)
    es_nomina = models.BooleanField(default=True)
    titular = models.CharField(max_length=150)
    cc_titular = models.CharField(max_length=50)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_cuentas_bancarias'

    def __str__(self):
        status = 'Nomina' if self.es_nomina else 'Secundaria'
        return f"Cuenta: {self.banco} {self.numero_cuenta} ({status})"
