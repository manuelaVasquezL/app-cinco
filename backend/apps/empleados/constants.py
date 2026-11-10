"""
Constantes semánticas de permisos y roles para el módulo de Empleados / Personal.
Centraliza los identificadores utilizados con `request.user.has_perm(...)` y evita strings mágicos.
"""


class EmpleadosPermisos:
    VER_CEDULA = "empleados.ver_cedula"
    VER_TODOS = "empleados.ver_todos_empleados"
    VER_EQUIPO = "empleados.ver_equipo_empleados"
    SOLICITAR_TRASLADO = "empleados.solicitar_traslado"
    APROBAR_TRASLADO = "empleados.aprobar_traslado"
    IMPORTAR_CONCILIACION = "empleados.importar_conciliacion"


class GruposCorporativos:
    GESTION_HUMANA = "Gestión Humana"
    SST = "SST"
    LIDERES_OPERACION = "Líderes de Operación"

