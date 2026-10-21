from rest_framework.routers import DefaultRouter
from apps.implementacion_fo.views import MappingPredioViewSet

router = DefaultRouter()
router.register(r"mapping-predios", MappingPredioViewSet, basename="mapping-predios")

urlpatterns = router.urls
