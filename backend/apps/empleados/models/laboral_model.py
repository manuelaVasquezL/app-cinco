from django.db import models
from django.utils import timezone
from .perfil_model import EmpleadoPerfil


class EmpleadoLaboral(models.Model):
    """
    Información contractual, cargo y control del ciclo de inducción / entrega por GH.
    """
    ETAPA_INDUCCION_CHOICES = [
        ('EN_FORMACION', 'En Formación (Gestión Humana)'),
        ('ENTREGADO', 'Entregado al Área Operativa'),
    ]

    TIPO_LABOR_CHOICES = [
        ('OPERATIVO', 'Operativo'),
        ('ADMINISTRATIVO', 'Administrativo'),
        ('SUPERVISOR', 'Supervisor'),
        ('TRANSVERSAL', 'Transversal'),
    ]

    id = models.BigAutoField(primary_key=True)
    empleado = models.OneToOneField(EmpleadoPerfil, on_delete=models.CASCADE, related_name='laboral')
    codigo_sap = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    sede = models.CharField(max_length=50, default='MEDELLIN')
    area = models.CharField(max_length=100)
    carpeta = models.CharField(max_length=100)
    puesto = models.CharField(max_length=150, blank=True, null=True)
    movil = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    cargo = models.CharField(max_length=100)
    funcion_cargo = models.CharField(max_length=255, blank=True, null=True)
    tipo_labor = models.CharField(max_length=50, choices=TIPO_LABOR_CHOICES, default='OPERATIVO')
    zona_nodo = models.CharField(max_length=100, blank=True, null=True)
    
    # Jerarquía y Mentores
    supervisor = models.ForeignKey(
        EmpleadoPerfil, on_delete=models.SET_NULL, null=True, blank=True, related_name='supervisados'
    )
    padrino = models.ForeignKey(
        EmpleadoPerfil, on_delete=models.SET_NULL, null=True, blank=True, related_name='ahijados'
    )
    formador = models.CharField(max_length=150, blank=True, null=True)
    grupo_comisiones = models.CharField(max_length=100, blank=True, null=True)
    nivel_estudio = models.CharField(max_length=100, blank=True, null=True)
    
    # Fechas laborales
    fecha_ingreso = models.DateField()
    fecha_egreso = models.DateField(blank=True, null=True)
    motivo_egreso = models.CharField(max_length=150, blank=True, null=True)
    motivo_egreso_real = models.CharField(max_length=255, blank=True, null=True)

    # Flujo de Inducción y Entrega por Gestión Humana
    etapa_induccion = models.CharField(max_length=30, choices=ETAPA_INDUCCION_CHOICES, default='EN_FORMACION')
    fecha_entrega_area = models.DateField(blank=True, null=True)
    entregado_por = models.ForeignKey(
        EmpleadoPerfil, on_delete=models.SET_NULL, null=True, blank=True, related_name='entregas_realizadas'
    )

    # Aprendices SENA
    practica_lectiva_inicio = models.DateField(blank=True, null=True)
    practica_lectiva_fin = models.DateField(blank=True, null=True)
    practica_productiva_inicio = models.DateField(blank=True, null=True)
    practica_productiva_fin = models.DateField(blank=True, null=True)

    class Meta:
        app_label = 'empleados'
        db_table = 'empleados_laboral'

    def __str__(self):
        return f"Laboral: {self.empleado.numero_documento} - {self.cargo}"

    @property
    def dias_para_periodo_prueba(self):
        if not self.fecha_ingreso:
            return None
        fin_prueba = self.fecha_ingreso + timezone.timedelta(days=60)
        delta = (fin_prueba - timezone.now().date()).days
        return delta

    @property
    def dias_en_empresa(self):
        if not self.fecha_ingreso:
            return 0
        fin = self.fecha_egreso or timezone.now().date()
        return max(0, (fin - self.fecha_ingreso).days)
