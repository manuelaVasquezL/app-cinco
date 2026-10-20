# apps/empleados/services/__init__.py
from .empleado_service import EmpleadoService
from .empleado_workflow_service import EmpleadoWorkflowService

__all__ = [
    'EmpleadoService',
    'EmpleadoWorkflowService',
]
