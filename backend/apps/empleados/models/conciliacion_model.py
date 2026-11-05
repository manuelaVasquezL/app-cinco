from django.db import models
from django.contrib.auth import get_user_model
from .perfil_model import EmpleadoPerfil

User = get_user_model()


class EmpleadoSSFF(models.Model):
    """
    Registros de personal importados desde SAP SuccessFactors (SSFF).
    Mantiene la relación relacional directa con el colaborador (EmpleadoPerfil) cuando existe en el sistema.
    """
    ESTADO_CHOICES = [
        ('ACTIVO', 'Activo'),
        ('INACTIVO', 'Inactivo'),
        ('DELETE', 'Retirado / Desactivado'),
    ]

    id = models.BigAutoField(primary_key=True)
    empleado = models.ForeignKey(
        EmpleadoPerfil,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='registros_ssff',
        help_text="Relación al perfil del colaborador en CINCO si existe en el sistema"
    )
    cedula = models.CharField(max_length=50, unique=True, db_index=True)
    nombres = models.CharField(max_length=150, blank=True, null=True)
    apellidos = models.CharField(max_length=150, blank=True, null=True)
    userid = models.CharField(max_length=50, blank=True, null=True, db_index=True, help_text="Código SAP del colaborador")
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='ACTIVO', db_index=True)
    datos = models.JSONField(blank=True, null=True, help_text="Datos completos normalizados del reporte SSFF")
    actualizado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ssff_actualizados'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_ssff'
        ordering = ['cedula']

    def __str__(self):
        return f"SSFF: {self.cedula} - {self.nombre_completo} ({self.estado})"

    @property
    def nombre_completo(self):
        if self.nombres or self.apellidos:
            return f"{self.nombres or ''} {self.apellidos or ''}".strip()
        if self.empleado:
            return self.empleado.nombre_completo
        if isinstance(self.datos, dict):
            return str(self.datos.get('nombre_completo', '') or self.datos.get('name', 'Sin nombre')).strip()
        return "Sin nombre"

    # Propiedades de compatibilidad para evitar roturas de esquemas previos
    @property
    def edit(self):
        return self.actualizado_por.username if self.actualizado_por else None

    @property
    def fecha_edit(self):
        return self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None


class EmpleadoSIIGO(models.Model):
    """
    Registros de personal y nómina importados desde SIIGO.
    Mantiene la relación relacional directa con el colaborador (EmpleadoPerfil) cuando existe en el sistema.
    """
    ESTADO_CHOICES = [
        ('ACTIVO', 'Activo'),
        ('INACTIVO', 'Inactivo'),
    ]

    id = models.BigAutoField(primary_key=True)
    empleado = models.ForeignKey(
        EmpleadoPerfil,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='registros_siigo',
        help_text="Relación al perfil del colaborador en CINCO si existe en el sistema"
    )
    cedula = models.CharField(max_length=50, unique=True, db_index=True)
    nombre_empleado = models.CharField(max_length=200, blank=True, null=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='ACTIVO', db_index=True)
    centro_costo = models.CharField(max_length=100, blank=True, null=True)
    salario = models.CharField(max_length=50, blank=True, null=True)
    datos = models.JSONField(blank=True, null=True, help_text="Datos completos normalizados del reporte SIIGO")
    actualizado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='siigo_actualizados'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_siigo'
        ordering = ['cedula']

    def __str__(self):
        return f"SIIGO: {self.cedula} - {self.nombre_empleado} ({self.estado})"

    # Propiedades de compatibilidad
    @property
    def edit(self):
        return self.actualizado_por.username if self.actualizado_por else None

    @property
    def fecha_edit(self):
        return self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None


# Aliases de retrocompatibilidad
EmpleadoBaseSSFF = EmpleadoSSFF
EmpleadoBaseSIIGO = EmpleadoSIIGO
