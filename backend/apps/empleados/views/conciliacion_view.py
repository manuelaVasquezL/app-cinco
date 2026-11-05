# apps/empleados/views/conciliacion_view.py
from django.db.models import Q
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.pagination import PageNumberPagination
from django.core.exceptions import ValidationError

from apps.empleados.models import EmpleadoSSFF, EmpleadoSIIGO
from apps.empleados.serializers.conciliacion_serializer import (
    EmpleadoSSFFSerializer,
    EmpleadoSIIGOSerializer,
)
from apps.empleados.services.conciliacion_service import ConciliacionService


class ConciliacionPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 500


class SSFFListView(APIView):
    """
    Lista y filtra los registros de personal importados desde SAP SuccessFactors (SSFF).
    Soporta filtros por estado (ACTIVO, INACTIVO, DELETE, TODOS) y búsqueda por texto.
    """
    pagination_class = ConciliacionPagination

    def get(self, request):
        queryset = EmpleadoSSFF.objects.select_related(
            'empleado', 'empleado__laboral', 'actualizado_por'
        ).all()

        estado = request.query_params.get('estado', '').strip().upper()
        if estado and estado != 'TODOS':
            if estado == 'INACTIVO':
                queryset = queryset.filter(Q(estado='INACTIVO') | Q(estado='DELETE'))
            else:
                queryset = queryset.filter(estado=estado)

        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(cedula__icontains=search) |
                Q(nombres__icontains=search) |
                Q(apellidos__icontains=search) |
                Q(userid__icontains=search) |
                Q(datos__icontains=search)
            )

        # Si se solicita explícitamente sin paginación (all=true)
        if request.query_params.get('all', '').lower() == 'true':
            serializer = EmpleadoSSFFSerializer(queryset, many=True)
            return Response(serializer.data)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            serializer = EmpleadoSSFFSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = EmpleadoSSFFSerializer(queryset, many=True)
        return Response(serializer.data)


class SSFFImportView(APIView):
    """
    Endpoint para procesar la subida del reporte CSV de SAP SuccessFactors.
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = (
            request.FILES.get('file') or
            request.FILES.get('archivo') or
            request.FILES.get('save_file_ssff')
        )
        if not file_obj:
            return Response(
                {'error': 'No se proporcionó ningún archivo CSV.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user if (request.user and request.user.is_authenticated) else None

        try:
            resultado = ConciliacionService.procesar_archivo_ssff(file_obj, user=user)
            return Response(resultado, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({'error': str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Error al procesar el archivo: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SIIGOListView(APIView):
    """
    Lista y filtra los registros de nómina y personal importados desde SIIGO.
    Soporta filtros por estado (ACTIVO, INACTIVO, TODOS) y búsqueda por texto.
    """
    pagination_class = ConciliacionPagination

    def get(self, request):
        queryset = EmpleadoSIIGO.objects.select_related(
            'empleado', 'empleado__laboral', 'actualizado_por'
        ).all()

        estado = request.query_params.get('estado', '').strip().upper()
        if estado and estado != 'TODOS':
            queryset = queryset.filter(estado=estado)

        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(cedula__icontains=search) |
                Q(nombre_empleado__icontains=search) |
                Q(centro_costo__icontains=search) |
                Q(datos__icontains=search)
            )

        if request.query_params.get('all', '').lower() == 'true':
            serializer = EmpleadoSIIGOSerializer(queryset, many=True)
            return Response(serializer.data)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            serializer = EmpleadoSIIGOSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = EmpleadoSIIGOSerializer(queryset, many=True)
        return Response(serializer.data)


class SIIGOImportView(APIView):
    """
    Endpoint para procesar la subida del reporte CSV de SIIGO.
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = (
            request.FILES.get('file') or
            request.FILES.get('archivo') or
            request.FILES.get('save_file_siigo')
        )
        if not file_obj:
            return Response(
                {'error': 'No se proporcionó ningún archivo CSV.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user if (request.user and request.user.is_authenticated) else None

        try:
            resultado = ConciliacionService.procesar_archivo_siigo(file_obj, user=user)
            return Response(resultado, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({'error': str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Error al procesar el archivo: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
