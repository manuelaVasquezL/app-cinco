"""
Permisos personalizados de Django REST Framework para el módulo de empleados.
Cumplimiento estricto de Habeas Data y control de acciones sensibles.
"""
from rest_framework.permissions import BasePermission
from apps.empleados.constants import EmpleadosPermisos


class PuedeVerDocumentoIdentidad(BasePermission):
    """
    Permiso para visualizar y descargar documentos de identidad (cédula digital frontal/reverso).
    Permite acceso únicamente a:
    1. Superusuarios.
    2. Usuarios con el permiso 'empleados.ver_cedula' (Gestión Humana, SST o asignación individual).
    3. El propio colaborador consultando su propio documento (auto-consulta).
    """
    message = "No tienes autorización para consultar documentos de identidad sensibles (Habeas Data)."

    @classmethod
    def tiene_acceso(cls, user, perfil_objetivo=None) -> bool:
        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        if user.has_perm(EmpleadosPermisos.VER_CEDULA):
            return True

        # Auto-consulta del propio colaborador
        if perfil_objetivo:
            if getattr(perfil_objetivo, 'user_id', None) == user.id:
                return True
            if getattr(perfil_objetivo, 'numero_documento', None) == user.username:
                return True

        return False

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser or request.user.has_perm(EmpleadosPermisos.VER_CEDULA):
            return True

        # Para acciones detail, se evalúa en has_object_permission contra el perfil objetivo
        return True

    def has_object_permission(self, request, view, obj):
        perfil = getattr(obj, 'empleado', obj)
        return self.tiene_acceso(request.user, perfil)


class PuedeAprobarTraslado(BasePermission):
    """
    Permiso exclusivo para aprobar o rechazar solicitudes de traslado (Gestión Humana).
    """
    message = "No tienes autorización para aprobar o rechazar traslados de personal."

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        return bool(user and (user.is_superuser or user.has_perm(EmpleadosPermisos.APROBAR_TRASLADO)))


class PuedeImportarConciliacion(BasePermission):
    """
    Permiso para cargar e importar archivos de conciliación SIIGO / SSFF.
    """
    message = "No tienes autorización para importar archivos de conciliación de nómina."

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        return bool(user and (user.is_superuser or user.has_perm(EmpleadosPermisos.IMPORTAR_CONCILIACION)))

