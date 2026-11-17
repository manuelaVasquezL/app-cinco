from django.core.management.base import BaseCommand
from apps.common.models.notificacion_correo import NotificacionCorreo
from apps.common.services.notificacion_correo_service import NotificacionCorreoService


class Command(BaseCommand):
    help = "Procesa el Outbox de notificaciones por correo institucional pendientes o en reintento (Patrón Transactional Outbox)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--batch-size',
            type=int,
            default=25,
            help='Cantidad máxima de correos a procesar en esta ejecución (default: 25)'
        )
        parser.add_argument(
            '--reintentar-fallidos',
            action='store_true',
            help='Reactiva todos los registros en estado FALLIDO pasándolos a PENDIENTE con 0 intentos'
        )

    def handle(self, *args, **options):
        batch_size = options['batch_size']
        reintentar_fallidos = options['reintentar_fallidos']

        if reintentar_fallidos:
            fallidos = NotificacionCorreo.objects.filter(estado=NotificacionCorreo.ESTADO_FALLIDO)
            count_fallidos = fallidos.count()
            for f in fallidos:
                f.forzar_reintento()
            self.stdout.write(
                self.style.WARNING(f"[Outbox Admin] Se han reactivado {count_fallidos} correos en estado FALLIDO a PENDIENTE.")
            )

        self.stdout.write(self.style.NOTICE(f"[Outbox] Iniciando procesamiento de notificaciones (batch_size={batch_size})..."))
        
        res = NotificacionCorreoService.procesar_pendientes(batch_size=batch_size)

        msg = (
            f"[Outbox Resumen] "
            f"Reclamados: {res['reclamados']} | "
            f"Enviados: {res['enviados']} | "
            f"En Reintento: {res['reintentos']} | "
            f"Fallidos: {res['fallidos']} | "
            f"Zombis Rescatados: {res['zombies_rescatados']}"
        )

        if res['enviados'] > 0:
            self.stdout.write(self.style.SUCCESS(msg))
        elif res['fallidos'] > 0:
            self.stdout.write(self.style.ERROR(msg))
        else:
            self.stdout.write(self.style.MIGRATE_HEADING(msg))

