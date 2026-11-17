from datetime import timedelta
from django.db import models
from django.utils import timezone


class NotificacionCorreo(models.Model):
    """
    Modelo de persistencia del Patrón Transactional Outbox para notificaciones
    institucionales por correo electrónico (Puntos 2.2 y 6).
    
    Garantiza durabilidad transaccional ACID, idempotencia por clave unívoca,
    prevención de condiciones de carrera con select_for_update(skip_locked=True)
    y reintentos automáticos con backoff exponencial.
    """
    ESTADO_PENDIENTE = 'PENDIENTE'
    ESTADO_PROCESANDO = 'PROCESANDO'
    ESTADO_ENVIADO = 'ENVIADO'
    ESTADO_REINTENTO = 'REINTENTO'
    ESTADO_FALLIDO = 'FALLIDO'

    ESTADOS = (
        (ESTADO_PENDIENTE, 'Pendiente'),
        (ESTADO_PROCESANDO, 'Procesando'),
        (ESTADO_ENVIADO, 'Enviado'),
        (ESTADO_REINTENTO, 'En Reintento'),
        (ESTADO_FALLIDO, 'Fallido'),
    )

    id = models.BigAutoField(primary_key=True)
    idempotency_key = models.CharField(
        max_length=150,
        unique=True,
        db_index=True,
        help_text="Clave unívoca del evento para prevenir duplicados a nivel de base de datos"
    )
    evento = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Tipo de evento: EGRESO, REACTIVACION, SOLICITUD_TRASLADO, etc."
    )

    # Destinatarios y Auditoría
    destinatarios_previstos = models.JSONField(
        help_text="Lista de correos institucionales según la regla de negocio"
    )
    destinatarios_reales = models.JSONField(
        default=list,
        blank=True,
        help_text="Correos a los que efectivamente se despachó el mensaje tras sandbox"
    )
    asunto = models.CharField(max_length=255)
    plantilla = models.CharField(
        max_length=120,
        help_text="Ruta relativa de la plantilla Django (ej: emails/notificacion_egreso.html)"
    )
    contexto = models.JSONField(
        default=dict,
        help_text="Variables sanitizadas requeridas para renderizar la plantilla (sin motivo_real)"
    )

    # Máquina de estados y reintentos
    estado = models.CharField(
        max_length=20,
        choices=ESTADOS,
        default=ESTADO_PENDIENTE,
        db_index=True
    )
    intentos = models.PositiveSmallIntegerField(default=0)
    max_intentos = models.PositiveSmallIntegerField(default=3)
    proximo_intento = models.DateTimeField(default=timezone.now, db_index=True)
    procesando_desde = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp para detección y rescate de bloqueos zombi (> 5 min)"
    )
    ultimo_error = models.TextField(null=True, blank=True)

    # Trazabilidad
    enviado_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    _database = 'default'

    class Meta:
        app_label = 'common'
        db_table = 'notificaciones_correo'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['estado', 'proximo_intento']),
            models.Index(fields=['evento', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.estado}] {self.evento} - {self.asunto} (ID #{self.id})"

    def marcar_enviado(self, destinatarios_reales: list):
        """Transiciona a estado terminal ENVIADO con timestamp de confirmación."""
        self.estado = self.ESTADO_ENVIADO
        self.destinatarios_reales = destinatarios_reales
        self.enviado_at = timezone.now()
        self.procesando_desde = None
        self.save(update_fields=['estado', 'destinatarios_reales', 'enviado_at', 'procesando_desde', 'updated_at'])

    def marcar_falla(self, error_msg: str):
        """
        Registra falla de despacho. Aplica backoff exponencial (2^intentos * 60s)
        o transiciona al estado terminal FALLIDO si se alcanza max_intentos.
        """
        self.intentos += 1
        self.ultimo_error = str(error_msg)[:2000]
        self.procesando_desde = None

        if self.intentos < self.max_intentos:
            delay_segundos = (2 ** (self.intentos - 1)) * 60  # Intento 1: 60s, Intento 2: 120s
            self.estado = self.ESTADO_REINTENTO
            self.proximo_intento = timezone.now() + timedelta(seconds=delay_segundos)
        else:
            self.estado = self.ESTADO_FALLIDO

        self.save(update_fields=['estado', 'intentos', 'ultimo_error', 'proximo_intento', 'procesando_desde', 'updated_at'])

    def forzar_reintento(self):
        """Permite que un administrador o comando reactive un registro FALLIDO."""
        self.estado = self.ESTADO_PENDIENTE
        self.intentos = 0
        self.proximo_intento = timezone.now()
        self.procesando_desde = None
        self.save(update_fields=['estado', 'intentos', 'proximo_intento', 'procesando_desde', 'updated_at'])
