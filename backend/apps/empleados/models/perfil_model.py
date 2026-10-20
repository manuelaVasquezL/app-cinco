from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class EmpleadoPerfil(models.Model):
    """
    Entidad principal de identidad y perfil del colaborador.
    Cada empleado tiene obligatoriamente un usuario vinculado en auth_user.
    """
    ESTADO_CHOICES = [
        ('ACTIVO', 'Activo'),
        ('INACTIVO', 'Inactivo'),
        ('SUSPENDIDO', 'Suspendido'),
        ('RETIRADO', 'Retirado'),
    ]

    TIPO_DOC_CHOICES = [
        ('CC', 'Cédula de Ciudadanía'),
        ('CE', 'Cédula de Extranjería'),
        ('PASAPORTE', 'Pasaporte'),
        ('PPT', 'Permiso por Protección Temporal'),
        ('PEP', 'Permiso Especial de Permanencia'),
    ]

    GENERO_CHOICES = [
        ('MASCULINO', 'Masculino'),
        ('FEMENINO', 'Femenino'),
        ('OTRO', 'Otro'),
    ]

    ESTADO_CIVIL_CHOICES = [
        ('SOLTERO', 'Soltero(a)'),
        ('CASADO', 'Casado(a)'),
        ('UNION_LIBRE', 'Unión Libre'),
        ('DIVORCIADO', 'Divorciado(a)'),
        ('VIUDO', 'Viudo(a)'),
    ]

    id = models.BigAutoField(primary_key=True)
    user = models.OneToOneField(
        User,
        on_delete=models.PROTECT,
        related_name='empleado_perfil',
        help_text="Cuenta de acceso del colaborador en el aplicativo"
    )
    tipo_documento = models.CharField(max_length=10, choices=TIPO_DOC_CHOICES, default='CC')
    numero_documento = models.CharField(max_length=50, unique=True, db_index=True)
    fecha_expedicion_documento = models.DateField(blank=True, null=True)
    pasaporte = models.CharField(max_length=50, blank=True, null=True, help_text="Cédula SIIGO / Alterno")
    nombres = models.CharField(max_length=150)
    apellidos = models.CharField(max_length=150)
    fecha_nacimiento = models.DateField(blank=True, null=True)
    genero = models.CharField(max_length=20, choices=GENERO_CHOICES, blank=True, null=True)
    estado_civil = models.CharField(max_length=30, choices=ESTADO_CIVIL_CHOICES, blank=True, null=True)
    foto_url = models.CharField(max_length=255, blank=True, null=True, default='photos/Default.png')
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='ACTIVO', db_index=True)
    datos_adicionales = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_perfil'
        ordering = ['apellidos', 'nombres']

    def __str__(self):
        return f"{self.numero_documento} - {self.nombres} {self.apellidos}"

    @property
    def nombre_completo(self):
        return f"{self.nombres} {self.apellidos}".strip()

    @property
    def dias_en_empresa(self):
        if hasattr(self, 'laboral') and self.laboral and self.laboral.fecha_ingreso:
            from django.utils import timezone
            fin = self.laboral.fecha_egreso or timezone.now().date()
            return max(0, (fin - self.laboral.fecha_ingreso).days)
        return 0
