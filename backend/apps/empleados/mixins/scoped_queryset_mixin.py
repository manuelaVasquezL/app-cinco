"""
Mixin de alcance de datos (Row-Level Security) para el módulo de empleados.
Garantiza que ningún usuario acceda a datos de colaboradores fuera de su jurisdicción.
"""
from django.db.models import Q
from apps.empleados.constants import EmpleadosPermisos


class ScopedEmpleadoQuerySetMixin:
    """
    Filtra automáticamente un QuerySet de EmpleadoPerfil según los permisos del usuario autenticado:
    - Superusuario o permiso 'ver_todos_empleados': Acceso global irrestricto.
    - Permiso 'ver_equipo_empleados': Acceso restringido a colaboradores de su área o supervisados directos.
    - Sin perfil o no autenticado: QuerySet vacío (none).
    - Colaborador regular: Únicamente su propio perfil.
    """

    def get_scoped_empleados_queryset(self, base_qs=None):
        if base_qs is None:
            from apps.empleados.models import EmpleadoPerfil
            base_qs = EmpleadoPerfil.objects.all()

        user = getattr(self.request, 'user', None)

        # 1. No autenticado
        if not user or not user.is_authenticated:
            return base_qs.none()

        # 2. Superusuario o permiso global (Gestión Humana, Gerencia, Sistemas)
        if user.is_superuser or user.has_perm(EmpleadosPermisos.VER_TODOS):
            return base_qs

        # 3. Manejo seguro de usuarios sin perfil (cuentas de servicio, bots o admins técnicos)
        perfil = getattr(user, 'empleado_perfil', None)
        if not perfil:
            return base_qs.none()

        # 4. Permiso de Equipo (Líderes de Operación, Supervisores, Coordinadores)
        if user.has_perm(EmpleadosPermisos.VER_EQUIPO):
            laboral = getattr(perfil, 'laboral', None)
            user_area = (laboral.area or '').strip() if laboral else ''

            if user_area:
                filtro_equipo = (
                    Q(laboral__supervisor=perfil) |
                    Q(laboral__area__iexact=user_area) |
                    Q(id=perfil.id)
                )
            else:
                filtro_equipo = (
                    Q(laboral__supervisor=perfil) |
                    Q(id=perfil.id)
                )

            return base_qs.filter(filtro_equipo).distinct()

        # 5. Colaborador regular: exclusivamente su propio perfil
        return base_qs.filter(id=perfil.id)

