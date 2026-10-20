# apps/empleados/models/__init__.py
# Modelos Legado (Compatibilidad temporal)
from .empleado_model import Empleado, EmpleadoSiigo

# Nuevos Modelos Relacionales Normalizados (especificacion_modelo_base_personal.md)
from .perfil_model import EmpleadoPerfil
from .laboral_model import EmpleadoLaboral
from .contacto_model import EmpleadoContacto
from .seguridad_social_model import EmpleadoSeguridadSocial
from .sst_model import EmpleadoCertificacionesSST
from .dotacion_model import EmpleadoDotacionActivos, EmpleadoDotacionComprobante
from .movilidad_model import EmpleadoMovilidad
from .bancario_model import EmpleadoCuentaBancaria
from .familia_model import EmpleadoContactoEmergencia, EmpleadoPersonaACargo
from .documentos_model import EmpleadoDocumentoAdjunto
from .auditoria_model import EmpleadoAuditoriaLog

__all__ = [
    'Empleado',
    'EmpleadoSiigo',
    'EmpleadoPerfil',
    'EmpleadoLaboral',
    'EmpleadoContacto',
    'EmpleadoSeguridadSocial',
    'EmpleadoCertificacionesSST',
    'EmpleadoDotacionActivos',
    'EmpleadoDotacionComprobante',
    'EmpleadoMovilidad',
    'EmpleadoCuentaBancaria',
    'EmpleadoContactoEmergencia',
    'EmpleadoPersonaACargo',
    'EmpleadoDocumentoAdjunto',
    'EmpleadoAuditoriaLog',
]
