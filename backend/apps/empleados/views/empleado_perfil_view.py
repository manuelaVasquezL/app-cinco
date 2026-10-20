from django.db.models import Q
from rest_framework import status, filters
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from apps.empleados.models import (
    EmpleadoPerfil,
    EmpleadoLaboral,
    EmpleadoMovilidad,
    EmpleadoAuditoriaLog,
    EmpleadoDocumentoAdjunto,
)
from apps.empleados.serializers import (
    EmpleadoPerfilListSerializer,
    EmpleadoPerfilDetailSerializer,
    EmpleadoAuditoriaLogSerializer,
    EntregaGHSerializer,
    AsignarPlacaSerializer,
    DesactivarEmpleadoSerializer,
    ReactivarEmpleadoSerializer,
    GestionarCuentaBancariaSerializer,
    EmpleadoCuentaBancariaSerializer,
    EmpleadoDocumentoAdjuntoSerializer,
)
from apps.empleados.services import EmpleadoWorkflowService


class EmpleadoPerfilViewSet(ModelViewSet):
    """
    ViewSet modular para la administración integral de personal (especificacion_modelo_base_personal.md).
    Proporciona operaciones CRUD, filtros avanzados, máquina de estados de inducción,
    asignación exclusiva de flota, desvinculación/reactivación y trazabilidad de auditoría.
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'numero_documento',
        'nombres',
        'apellidos',
        'laboral__cargo',
        'laboral__movil',
        'movilidad__placa_vehiculo',
    ]

    def get_queryset(self):
        qs = EmpleadoPerfil.objects.select_related(
            'laboral',
            'laboral__supervisor',
            'laboral__padrino',
            'laboral__entregado_por',
            'contacto',
            'seguridad_social',
            'certificaciones_sst',
            'dotacion_activos',
            'movilidad',
        ).prefetch_related(
            'cuentas_bancarias',
            'contactos_emergencia',
            'personas_a_cargo',
            'documentos_adjuntos',
            'comprobantes_dotacion',
        )

        params = self.request.query_params

        # Filtrado por estado: por defecto solo ACTIVO, salvo 'all' o un estado específico
        estado = params.get('estado')
        if estado and estado.lower() != 'all':
            qs = qs.filter(estado=estado.upper())
        elif not estado:
            qs = qs.filter(estado='ACTIVO')

        # Filtros de estructura organizativa
        area = params.get('area')
        if area:
            qs = qs.filter(laboral__area__icontains=area)

        carpeta = params.get('carpeta')
        if carpeta:
            qs = qs.filter(laboral__carpeta__icontains=carpeta)

        sede = params.get('sede')
        if sede:
            qs = qs.filter(laboral__sede__icontains=sede)

        cargo = params.get('cargo')
        if cargo:
            qs = qs.filter(laboral__cargo__icontains=cargo)

        movil = params.get('movil')
        if movil:
            qs = qs.filter(laboral__movil__icontains=movil)

        tipo_labor = params.get('tipo_labor')
        if tipo_labor:
            qs = qs.filter(laboral__tipo_labor=tipo_labor.upper())

        etapa_induccion = params.get('etapa_induccion')
        if etapa_induccion:
            qs = qs.filter(laboral__etapa_induccion=etapa_induccion.upper())

        search = params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(numero_documento__icontains=search) |
                Q(nombres__icontains=search) |
                Q(apellidos__icontains=search) |
                Q(laboral__cargo__icontains=search) |
                Q(laboral__movil__icontains=search) |
                Q(movilidad__placa_vehiculo__icontains=search)
            )

        return qs.order_by('apellidos', 'nombres')

    def get_serializer_class(self):
        if self.action == 'list':
            return EmpleadoPerfilListSerializer
        return EmpleadoPerfilDetailSerializer

    def create(self, request, *args, **kwargs):
        """
        Creación transaccional con aprovisionamiento de auth_user y etapa de inducción inicial.
        """
        try:
            ip_address = request.META.get('REMOTE_ADDR')
            perfil = EmpleadoWorkflowService.crear_empleado(
                data=request.data,
                user_creator=request.user,
                ip_address=ip_address
            )
            serializer = EmpleadoPerfilDetailSerializer(perfil)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            msg = getattr(e, 'message', None) or (e.messages[0] if hasattr(e, 'messages') else str(e))
            return Response({'detail': msg, 'error': msg}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='entregar-gh')
    def entregar_gh(self, request, pk=None):
        """
        Procedimiento Operativo: Entrega formal de personal por Gestión Humana al área operativa.
        Transiciona etapa_induccion a 'ENTREGADO'.
        """
        serializer = EntregaGHSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ip_address = request.META.get('REMOTE_ADDR')
        laboral = EmpleadoWorkflowService.entregar_empleado_gh(
            empleado_id=pk,
            supervisor_recibe_id=serializer.validated_data['supervisor_recibe_id'],
            user_operator=request.user,
            ip_address=ip_address
        )
        return Response({
            'success': True,
            'msg': 'Colaborador entregado al área operativa con éxito.',
            'etapa_induccion': laboral.etapa_induccion,
            'area': laboral.area,
            'carpeta': laboral.carpeta,
        })

    @action(detail=True, methods=['post'], url_path='asignar-placa')
    def asignar_placa(self, request, pk=None):
        """
        Asignación exclusiva de placa vehicular garantizando que no esté duplicada.
        """
        serializer = AsignarPlacaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ip_address = request.META.get('REMOTE_ADDR')
        conduce_val = serializer.validated_data.get('sabe_conducir')
        if conduce_val is None:
            conduce_val = serializer.validated_data.get('conduce', False)

        movilidad = EmpleadoWorkflowService.asignar_placa_vehiculo(
            empleado_id=pk,
            placa=serializer.validated_data['placa'],
            conduce=conduce_val,
            medio_transporte=serializer.validated_data.get('medio_transporte', 'NINGUNO'),
            modelo_vehiculo=serializer.validated_data.get('modelo_vehiculo', ''),
            user_operator=request.user,
            ip_address=ip_address
        )
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoMovilidadSerializer
        return Response({
            'success': True,
            'msg': f'Placa {movilidad.placa_vehiculo} asignada correctamente.',
            'placa_vehiculo': movilidad.placa_vehiculo,
            'movilidad': EmpleadoMovilidadSerializer(movilidad).data,
        })

    @action(detail=True, methods=['post'], url_path='desactivar')
    def desactivar(self, request, pk=None):
        """
        Proceso formal de egreso/retiro con doble motivo, revocación de credenciales y liberación de flota.
        """
        serializer = DesactivarEmpleadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ip_address = request.META.get('REMOTE_ADDR')
        perfil = EmpleadoWorkflowService.desactivar_empleado(
            empleado_id=pk,
            fecha_egreso=serializer.validated_data['fecha_egreso'],
            motivo=serializer.validated_data['motivo'],
            motivo_real=serializer.validated_data.get('motivo_real', ''),
            user_operator=request.user,
            ip_address=ip_address
        )
        return Response({
            'success': True,
            'msg': f'Empleado {perfil.nombre_completo} retirado del sistema.',
            'estado': perfil.estado,
        })

    @action(detail=True, methods=['post'], url_path='reactivar')
    def reactivar(self, request, pk=None):
        """
        Reactivación de colaborador inactivo con restablecimiento de credenciales.
        """
        serializer = ReactivarEmpleadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ip_address = request.META.get('REMOTE_ADDR')
        perfil = EmpleadoWorkflowService.reactivar_empleado(
            empleado_id=pk,
            movil_inicial=serializer.validated_data.get('movil_inicial', '1 - SIN ASIGNAR'),
            user_operator=request.user,
            ip_address=ip_address
        )
        return Response({
            'success': True,
            'msg': f'Empleado {perfil.nombre_completo} reactivado exitosamente.',
            'estado': perfil.estado,
        })

    @action(detail=True, methods=['post'], url_path='cuentas-bancarias')
    def gestionar_cuenta_bancaria(self, request, pk=None):
        """
        Alta o actualización de cuenta bancaria con normalización a 12 dígitos y exclusividad de nómina.
        """
        serializer = GestionarCuentaBancariaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ip_address = request.META.get('REMOTE_ADDR')
        cuenta = EmpleadoWorkflowService.gestionar_cuenta_bancaria(
            empleado_id=pk,
            banco=serializer.validated_data['banco'],
            numero_cuenta=serializer.validated_data['numero_cuenta'],
            tipo_cuenta=serializer.validated_data.get('tipo_cuenta', 'AHORROS'),
            es_nomina=serializer.validated_data.get('es_nomina', True),
            titular=serializer.validated_data.get('titular', ''),
            cc_titular=serializer.validated_data.get('cc_titular', ''),
            cuenta_id=serializer.validated_data.get('cuenta_id'),
            user_operator=request.user,
            ip_address=ip_address
        )
        return Response(EmpleadoCuentaBancariaSerializer(cuenta).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='contactos-emergencia')
    def gestionar_contacto_emergencia(self, request, pk=None):
        """
        Alta o actualización de contacto de emergencia en la red de apoyo (Tabla 9).
        """
        from apps.empleados.serializers.empleado_perfil_serializer import (
            GestionarContactoEmergenciaSerializer,
            EmpleadoContactoEmergenciaSerializer,
        )
        serializer = GestionarContactoEmergenciaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ip_address = request.META.get('REMOTE_ADDR')
        contacto = EmpleadoWorkflowService.gestionar_contacto_emergencia(
            empleado_id=pk,
            nombre_completo=serializer.validated_data['nombre_completo'],
            parentesco=serializer.validated_data['parentesco'],
            telefono=serializer.validated_data['telefono'],
            es_principal=serializer.validated_data.get('es_principal', False),
            contacto_id=serializer.validated_data.get('contacto_id'),
            user_operator=request.user,
            ip_address=ip_address
        )
        return Response(EmpleadoContactoEmergenciaSerializer(contacto).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path=r'contactos-emergencia/(?P<contacto_id>[^/.]+)')
    def eliminar_contacto_emergencia(self, request, pk=None, contacto_id=None):
        """
        Eliminación de un contacto de emergencia con traza de auditoría.
        """
        ip_address = request.META.get('REMOTE_ADDR')
        EmpleadoWorkflowService.eliminar_contacto_emergencia(
            empleado_id=pk,
            contacto_id=int(contacto_id),
            user_operator=request.user,
            ip_address=ip_address
        )
        return Response({
            'success': True,
            'msg': 'Contacto de emergencia eliminado exitosamente.'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='auditoria')
    def auditoria(self, request, pk=None):
        """
        Consulta del historial cronológico de auditoría y diffs del colaborador.
        """
        logs = EmpleadoAuditoriaLog.objects.filter(empleado_id=pk).select_related('usuario').order_by('-created_at')
        serializer = EmpleadoAuditoriaLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='subir-documento', parser_classes=[MultiPartParser, FormParser])
    def subir_documento(self, request, pk=None):
        """
        Sube o actualiza un documento adjunto del colaborador (ej. CEDULA_FRONTAL, CEDULA_POSTERIOR).
        Guarda en media/infraestructura/<categoria>/ y registra en empleados_documentos_adjuntos.
        """
        import os
        from django.conf import settings

        perfil = self.get_object()
        tipo_documento = request.data.get('tipo_documento', '').strip().upper()
        archivo = request.FILES.get('archivo') or request.FILES.get('file')

        if not tipo_documento:
            return Response(
                {'error': 'El campo tipo_documento es obligatorio (ej. CEDULA_FRONTAL, CEDULA_POSTERIOR).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not archivo:
            return Response(
                {'error': 'No se proporcionó ningún archivo para subir.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        nombre_original = archivo.name
        ext = os.path.splitext(nombre_original)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.pdf', '.webp']:
            return Response(
                {'error': 'Formato no soportado. Formatos permitidos: JPG, PNG, WEBP, PDF.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Estructura organizada dentro de media/infraestructura/
        if tipo_documento in ['CEDULA_FRONTAL', 'CEDULA_POSTERIOR']:
            categoria = 'cedulas'
            lado = 'frontal' if tipo_documento == 'CEDULA_FRONTAL' else 'posterior'
            nombre_guardado = f"{perfil.numero_documento}_cedula_{lado}{ext}"
        elif tipo_documento in ['CERTIFICADO_ALTURAS', 'ALTURAS']:
            categoria = 'alturas'
            nombre_guardado = f"{perfil.numero_documento}_certificado_alturas{ext}"
        elif tipo_documento in ['PERMISO_TRABAJO', 'PERMISO']:
            categoria = 'alturas'
            nombre_guardado = f"{perfil.numero_documento}_permiso_trabajo{ext}"
        elif tipo_documento in ['CERTIFICADO_TECNICO', 'CERTIFICADO_MEDICO', 'EXAMEN_MEDICO']:
            categoria = 'examenes_medicos'
            nombre_guardado = f"{perfil.numero_documento}_examen_medico{ext}"
        elif tipo_documento in ['LICENCIA_CONDUCCION', 'LICENCIA']:
            categoria = 'licencias'
            nombre_guardado = f"{perfil.numero_documento}_licencia_conduccion{ext}"
        else:
            categoria = 'otros'
            nombre_guardado = f"{perfil.numero_documento}_{tipo_documento.lower()}{ext}"

        sub_dir = os.path.join(settings.MEDIA_ROOT, 'infraestructura', categoria)
        os.makedirs(sub_dir, exist_ok=True)

        ruta_absoluta = os.path.join(sub_dir, nombre_guardado)

        with open(ruta_absoluta, 'wb+') as destino:
            for chunk in archivo.chunks():
                destino.write(chunk)

        archivo_url = f"/media/infraestructura/{categoria}/{nombre_guardado}"

        doc, created = EmpleadoDocumentoAdjunto.objects.update_or_create(
            empleado=perfil,
            tipo_documento=tipo_documento,
            defaults={'archivo_url': archivo_url}
        )

        # Sincronizar con EmpleadoCertificacionesSST si es certificado de SST
        if tipo_documento == 'CERTIFICADO_ALTURAS':
            from apps.empleados.models import EmpleadoCertificacionesSST
            sst, _ = EmpleadoCertificacionesSST.objects.get_or_create(empleado=perfil)
            sst.certificado_alturas_url = archivo_url
            sst.save(update_fields=['certificado_alturas_url'])
        elif tipo_documento in ['CERTIFICADO_TECNICO', 'CERTIFICADO_MEDICO']:
            from apps.empleados.models import EmpleadoCertificacionesSST
            sst, _ = EmpleadoCertificacionesSST.objects.get_or_create(empleado=perfil)
            sst.certificado_tecnico_url = archivo_url
            sst.save(update_fields=['certificado_tecnico_url'])

        try:
            EmpleadoAuditoriaLog.objects.create(
                empleado=perfil,
                usuario=request.user if request.user.is_authenticated else None,
                accion='ACTUALIZACION',
                tabla_afectada='empleados_documentos_adjuntos',
                datos_anteriores=None,
                datos_nuevos={'tipo_documento': tipo_documento, 'archivo_url': archivo_url, 'archivo_nombre': nombre_original},
                ip_origen=request.META.get('REMOTE_ADDR')
            )
        except Exception:
            pass

        return Response(EmpleadoDocumentoAdjuntoSerializer(doc).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='documentos/(?P<tipo_documento>[^/.]+)')
    def eliminar_documento(self, request, pk=None, tipo_documento=None):
        """
        Elimina un documento adjunto por su tipo (ej. CEDULA_FRONTAL).
        """
        perfil = self.get_object()
        tipo = (tipo_documento or '').strip().upper()
        doc = EmpleadoDocumentoAdjunto.objects.filter(empleado=perfil, tipo_documento=tipo).first()
        if not doc:
            return Response({'error': 'Documento no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        
        # Eliminar archivo físico de disco si existe
        if doc.archivo_url:
            try:
                rel_path = doc.archivo_url.lstrip('/')
                if rel_path.startswith('media/'):
                    rel_path = rel_path[6:]
                full_path = os.path.join(settings.MEDIA_ROOT, rel_path)
                if os.path.exists(full_path):
                    os.remove(full_path)
            except Exception:
                pass

        doc.delete()

        # Limpiar referencia en EmpleadoCertificacionesSST si es certificado SST
        if tipo == 'CERTIFICADO_ALTURAS':
            from apps.empleados.models import EmpleadoCertificacionesSST
            sst = EmpleadoCertificacionesSST.objects.filter(empleado=perfil).first()
            if sst:
                sst.certificado_alturas_url = None
                sst.save(update_fields=['certificado_alturas_url'])
        elif tipo in ['CERTIFICADO_TECNICO', 'CERTIFICADO_MEDICO']:
            from apps.empleados.models import EmpleadoCertificacionesSST
            sst = EmpleadoCertificacionesSST.objects.filter(empleado=perfil).first()
            if sst:
                sst.certificado_tecnico_url = None
                sst.save(update_fields=['certificado_tecnico_url'])

        return Response({'success': True, 'msg': f'Documento {tipo} eliminado correctamente.'})

    @action(detail=False, methods=['get'], url_path='supervisores')
    def lista_supervisores(self, request):
        """
        Endpoint auxiliar liviano para poblar dropdowns de supervisores/líderes operativos.
        """
        supervisores = EmpleadoPerfil.objects.filter(
            estado='ACTIVO',
            laboral__tipo_labor__in=['SUPERVISOR', 'ADMINISTRATIVO']
        ).values('id', 'numero_documento', 'nombres', 'apellidos', 'laboral__cargo', 'laboral__area', 'laboral__movil')
        
        resultado = [
            {
                'id': s['id'],
                'documento': s['numero_documento'],
                'nombre': f"{s['nombres']} {s['apellidos']}".strip(),
                'nombre_completo': f"{s['nombres']} {s['apellidos']}".strip(),
                'cargo': s['laboral__cargo'],
                'area': s['laboral__area'],
                'movil': s.get('laboral__movil') or '',
            }
            for s in supervisores
        ]
        return Response(resultado)
