from rest_framework.routers import DefaultRouter
from apps.empleados.views import EmpleadoViewSet, EmpleadoPerfilViewSet

router = DefaultRouter()
# Endpoint existente para certificados laborales y búsquedas rápidas (compatibilidad)
router.register(r'empleados', EmpleadoViewSet, basename='empleados')

# Nuevo endpoint maestro normalizado (especificacion_modelo_base_personal.md)
router.register(r'perfiles', EmpleadoPerfilViewSet, basename='perfiles')

urlpatterns = router.urls
