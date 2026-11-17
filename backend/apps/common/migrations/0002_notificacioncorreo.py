import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('common', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='NotificacionCorreo',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('idempotency_key', models.CharField(db_index=True, help_text='Clave unívoca del evento para prevenir duplicados a nivel de base de datos', max_length=150, unique=True)),
                ('evento', models.CharField(db_index=True, help_text='Tipo de evento: EGRESO, REACTIVACION, SOLICITUD_TRASLADO, etc.', max_length=50)),
                ('destinatarios_previstos', models.JSONField(help_text='Lista de correos institucionales según la regla de negocio')),
                ('destinatarios_reales', models.JSONField(blank=True, default=list, help_text='Correos a los que efectivamente se despachó el mensaje tras sandbox')),
                ('asunto', models.CharField(max_length=255)),
                ('plantilla', models.CharField(help_text='Ruta relativa de la plantilla Django (ej: emails/notificacion_egreso.html)', max_length=120)),
                ('contexto', models.JSONField(default=dict, help_text='Variables sanitizadas requeridas para renderizar la plantilla (sin motivo_real)')),
                ('estado', models.CharField(choices=[('PENDIENTE', 'Pendiente'), ('PROCESANDO', 'Procesando'), ('ENVIADO', 'Enviado'), ('REINTENTO', 'En Reintento'), ('FALLIDO', 'Fallido')], db_index=True, default='PENDIENTE', max_length=20)),
                ('intentos', models.PositiveSmallIntegerField(default=0)),
                ('max_intentos', models.PositiveSmallIntegerField(default=3)),
                ('proximo_intento', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('procesando_desde', models.DateTimeField(blank=True, help_text='Timestamp para detección y rescate de bloqueos zombi (> 5 min)', null=True)),
                ('ultimo_error', models.TextField(blank=True, null=True)),
                ('enviado_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'notificaciones_correo',
                'ordering': ['created_at'],
                'indexes': [
                    models.Index(fields=['estado', 'proximo_intento'], name='notificacio_estado_7c28e4_idx'),
                    models.Index(fields=['evento', 'created_at'], name='notificacio_evento_1ebb6e_idx'),
                ],
            },
        ),
    ]

