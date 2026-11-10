/**
 * Catálogo centralizado de permisos semánticos de la aplicación.
 * Mapeo 1:1 con auth_permission en el backend.
 */
export const PERMISOS = {
  // Módulo Empleados / Personal
  EMPLEADOS_VER_CEDULA: "empleados.ver_cedula",
  EMPLEADOS_VER_TODOS: "empleados.ver_todos_empleados",
  EMPLEADOS_VER_EQUIPO: "empleados.ver_equipo_empleados",
  EMPLEADOS_SOLICITAR_TRASLADO: "empleados.solicitar_traslado",
  EMPLEADOS_APROBAR_TRASLADO: "empleados.aprobar_traslado",
  EMPLEADOS_IMPORTAR_CONCILIACION: "empleados.importar_conciliacion",
} as const;

export type AppPermiso = typeof PERMISOS[keyof typeof PERMISOS];

