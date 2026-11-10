# backend/apps/empleados/management/commands/setup_roles_permisos.py
"""
Comando de inicialización de Grupos y Permisos base para CINCO SAS.
Idempotente: se puede ejecutar en despliegues iniciales o continuos sin duplicar registros.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from apps.empleados.constants import GruposCorporativos


class Command(BaseCommand):
    help = "Inicializa los Grupos y asigna los permisos semánticos base del módulo de Personal"

    def handle(self, *args, **options):
        self.stdout.write("Configurando grupos y permisos base para CINCO SAS...")

        # Matriz de asignación de permisos por grupo
        config_grupos = {
            GruposCorporativos.GESTION_HUMANA: [
                "ver_todos_empleados",
                "ver_cedula",
                "aprobar_traslado",
                "importar_conciliacion",
                "view_empleadoperfil",
                "change_empleadoperfil",
            ],
            GruposCorporativos.SST: [
                "ver_todos_empleados",
                "ver_cedula",
                "view_empleadoperfil",
            ],
            GruposCorporativos.LIDERES_OPERACION: [
                "ver_equipo_empleados",
                "solicitar_traslado",
                "view_empleadoperfil",
            ],
        }

        # Cache de permisos de la app empleados
        permisos_disponibles = {
            p.codename: p
            for p in Permission.objects.filter(content_type__app_label="empleados")
        }

        for nombre_grupo, codenames in config_grupos.items():
            grupo, created = Group.objects.get_or_create(name=nombre_grupo)
            accion = "creado" if created else "existente"

            permisos_a_asignar = []
            for codename in codenames:
                permiso = permisos_disponibles.get(codename)
                if permiso:
                    permisos_a_asignar.append(permiso)
                else:
                    self.stdout.write(
                        self.style.WARNING(
                            f"  [!] Permiso '{codename}' no encontrado en auth_permission"
                        )
                    )

            grupo.permissions.set(permisos_a_asignar)
            self.stdout.write(
                self.style.SUCCESS(
                    f"  [OK] Grupo '{nombre_grupo}' ({accion}): {len(permisos_a_asignar)} permisos vinculados."
                )
            )

        self.stdout.write(self.style.SUCCESS("\nInicialización de roles y permisos completada con éxito."))

