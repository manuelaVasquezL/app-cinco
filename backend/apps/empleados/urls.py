from django.urls import path
from rest_framework.routers import DefaultRouter
from apps.empleados.views import (
    EmpleadoViewSet,
    EmpleadoPerfilViewSet,
    SSFFListView,
    SSFFImportView,
    SIIGOListView,
    SIIGOImportView,
)

router = DefaultRouter()
# Endpoint existente para certificados laborales y búsquedas rápidas (compatibilidad)
router.register(r'empleados', EmpleadoViewSet, basename='empleados')

# Nuevo endpoint maestro normalizado (especificacion_modelo_base_personal.md)
router.register(r'perfiles', EmpleadoPerfilViewSet, basename='perfiles')

urlpatterns = [
    path('conciliacion/ssff/', SSFFListView.as_view(), name='conciliacion-ssff-list'),
    path('conciliacion/ssff/importar/', SSFFImportView.as_view(), name='conciliacion-ssff-import'),
    path('conciliacion/siigo/', SIIGOListView.as_view(), name='conciliacion-siigo-list'),
    path('conciliacion/siigo/importar/', SIIGOImportView.as_view(), name='conciliacion-siigo-import'),
] + router.urls
