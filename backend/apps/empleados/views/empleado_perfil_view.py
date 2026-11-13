import logging
from django.db import connections
from django.db.models import Q
from django.core.exceptions import ValidationError
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
    EmpleadoDotacionComprobante,
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
    EmpleadoDotacionComprobanteSerializer,
)
from apps.empleados.services import EmpleadoWorkflowService
from apps.empleados.mixins import ScopedEmpleadoQuerySetMixin


logger = logging.getLogger(__name__)


class EmpleadoPerfilViewSet(ScopedEmpleadoQuerySetMixin, ModelViewSet):
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
        base_qs = EmpleadoPerfil.objects.select_related(
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

        qs = self.get_scoped_empleados_queryset(base_qs=base_qs)

        params = getattr(self.request, 'query_params', None)
        if params is None:
            params = getattr(self.request, 'GET', {})

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

        # Filtro de colaboradores en período de prueba (Regla Legacy 2.9 / getInfoContratosPeriodoPrueba)
        periodo_prueba = params.get('periodo_prueba')
        if periodo_prueba and str(periodo_prueba).lower() in ['true', '1', 'si']:
            from datetime import timedelta
            from django.utils import timezone
            limite = timezone.now().date() - timedelta(days=62)
            qs = qs.filter(
                estado='ACTIVO',
                laboral__fecha_ingreso__gte=limite,
                laboral__fecha_ingreso__lte=timezone.now().date()
            ).order_by('laboral__fecha_ingreso')

        # Filtro de aprendices en prácticas SENA (Regla Legacy 2.8 / getInfoContratosPracticas)
        practicas = params.get('solo_practicas') or params.get('practicas')
        if practicas and str(practicas).lower() in ['true', '1', 'si']:
            qs = qs.filter(
                Q(laboral__practica_lectiva_inicio__isnull=False) |
                Q(laboral__practica_lectiva_fin__isnull=False) |
                Q(laboral__practica_productiva_inicio__isnull=False) |
                Q(laboral__practica_productiva_fin__isnull=False) |
                Q(laboral__cargo__icontains='APRENDIZ')
            )

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

        if periodo_prueba and str(periodo_prueba).lower() in ['true', '1', 'si']:
            return qs.order_by('laboral__fecha_ingreso')

        return qs.order_by('apellidos', 'nombres')

    def get_serializer_class(self):
        if self.action == 'list':
            return EmpleadoPerfilListSerializer
        return EmpleadoPerfilDetailSerializer

    def list(self, request, *args, **kwargs):
        """
        Listado optimizado de colaboradores con paginación, filtros avanzados y
        conteo unificado de actas de dotación (Punto 2.11: App Cinco + Legacy SST).
        """
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        targets = page if page is not None else list(queryset)

        cnt_map = {}
        cedulas = [p.numero_documento for p in targets if p.numero_documento]
        legacy_counts = {}
        if cedulas:
            try:
                conn_azul = connections['azul']
                with conn_azul.cursor() as c_azul:
                    format_strings = ','.join(['%s'] * len(cedulas))
                    c_azul.execute(
                        f"SELECT cedula, COUNT(*) FROM sst_base_entrega_dotacion WHERE cedula IN ({format_strings}) GROUP BY cedula",
                        cedulas
                    )
                    for r in c_azul.fetchall():
                        legacy_counts[str(r[0]).strip()] = r[1]
            except Exception as e:
                logger.warning(f"Error consultando conteo de dotación legacy en lista de personal: {e}")

        for p in targets:
            doc = str(p.numero_documento).strip() if p.numero_documento else ''
            local_cnt = len(p.comprobantes_dotacion.all()) if hasattr(p, 'comprobantes_dotacion') else 0
            leg_cnt = legacy_counts.get(doc, 0)
            cnt_map[p.id] = local_cnt + leg_cnt

        context = self.get_serializer_context()
        context['cnt_dotacion_map'] = cnt_map

        if page is not None:
            serializer = self.get_serializer(page, many=True, context=context)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True, context=context)
        return Response(serializer.data)

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
        auxiliares = getattr(perfil, 'auxiliares_desvinculados', [])
        msg = f'Empleado {perfil.nombre_completo} retirado del sistema.'
        if auxiliares:
            cnt = len(auxiliares)
            nombres_aux = ', '.join([a['nombre_completo'] for a in auxiliares[:3]])
            msg += f' Se desvincularon automáticamente {cnt} colaborador(es) de la cuadrilla ({nombres_aux}) a "1 - SIN ASIGNAR".'

        return Response({
            'success': True,
            'msg': msg,
            'estado': perfil.estado,
            'auxiliares_desvinculados': auxiliares,
        })

    @action(detail=True, methods=['get'], url_path='movil-previa')
    def movil_previa(self, request, pk=None):
        """
        Consulta el móvil previo registrado antes de la desactivación (Regla Legacy 2.7).
        """
        movil = EmpleadoWorkflowService.obtener_movil_previa_desactivacion(pk)
        return Response({'movil_previa': movil})

    @action(detail=True, methods=['post'], url_path='reactivar')
    def reactivar(self, request, pk=None):
        """
        Reactivación de colaborador inactivo con restablecimiento de credenciales y recuperación de móvil (Regla Legacy 2.7).
        """
        serializer = ReactivarEmpleadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ip_address = request.META.get('REMOTE_ADDR')
        perfil = EmpleadoWorkflowService.reactivar_empleado(
            empleado_id=pk,
            movil_inicial=serializer.validated_data.get('movil_inicial'),
            observaciones=serializer.validated_data.get('observaciones', ''),
            user_operator=request.user,
            ip_address=ip_address
        )
        return Response({
            'success': True,
            'msg': f'Empleado {perfil.nombre_completo} reactivado exitosamente con móvil "{perfil.laboral.movil}".',
            'estado': perfil.estado,
            'movil': perfil.laboral.movil,
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

    @action(detail=True, methods=['post'], url_path='personas-a-cargo')
    def gestionar_persona_a_cargo(self, request, pk=None):
        """
        Alta o actualización de persona a cargo / beneficiario (empleados_personas_a_cargo).
        """
        from apps.empleados.serializers.empleado_perfil_serializer import (
            GestionarPersonaACargoSerializer,
            EmpleadoPersonaACargoSerializer,
        )
        serializer = GestionarPersonaACargoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ip_address = request.META.get('REMOTE_ADDR')
        persona = EmpleadoWorkflowService.gestionar_persona_a_cargo(
            empleado_id=pk,
            nombre_completo=serializer.validated_data['nombre_completo'],
            parentesco=serializer.validated_data['parentesco'],
            tipo_documento=serializer.validated_data.get('tipo_documento'),
            numero_documento=serializer.validated_data.get('numero_documento'),
            fecha_nacimiento=serializer.validated_data.get('fecha_nacimiento'),
            persona_id=serializer.validated_data.get('persona_id'),
            user_operator=request.user,
            ip_address=ip_address
        )
        return Response(EmpleadoPersonaACargoSerializer(persona).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path=r'personas-a-cargo/(?P<persona_id>[^/.]+)')
    def eliminar_persona_a_cargo(self, request, pk=None, persona_id=None):
        """
        Eliminación de persona a cargo con traza de auditoría.
        """
        ip_address = request.META.get('REMOTE_ADDR')
        EmpleadoWorkflowService.eliminar_persona_a_cargo(
            empleado_id=pk,
            persona_id=int(persona_id),
            user_operator=request.user,
            ip_address=ip_address
        )
        return Response({
            'success': True,
            'msg': 'Persona a cargo eliminada exitosamente.'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='auditoria')
    def auditoria(self, request, pk=None):
        """
        Consulta del historial cronológico de auditoría y diffs del colaborador.
        """
        logs = EmpleadoAuditoriaLog.objects.filter(empleado_id=pk).select_related('usuario', 'usuario__empleado_perfil').order_by('-created_at')
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
        elif tipo_documento in ['CERTIFICADO_COORDINADOR', 'COORDINADOR_ALTURAS', 'COORDINADOR']:
            categoria = 'alturas'
            nombre_guardado = f"{perfil.numero_documento}_certificado_coordinador{ext}"
        elif tipo_documento in ['CERTIFICADO_ARL', 'ARL']:
            categoria = 'arl'
            nombre_guardado = f"{perfil.numero_documento}_certificado_arl{ext}"
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

        # Sincronizar con EmpleadoCertificacionesSST o EmpleadoSeguridadSocial
        if tipo_documento in ['CERTIFICADO_ALTURAS', 'ALTURAS']:
            from apps.empleados.models import EmpleadoCertificacionesSST
            sst, _ = EmpleadoCertificacionesSST.objects.get_or_create(empleado=perfil)
            sst.certificado_alturas_url = archivo_url
            sst.save(update_fields=['certificado_alturas_url'])
        elif tipo_documento in ['CERTIFICADO_COORDINADOR', 'COORDINADOR_ALTURAS', 'COORDINADOR']:
            from apps.empleados.models import EmpleadoCertificacionesSST
            sst, _ = EmpleadoCertificacionesSST.objects.get_or_create(empleado=perfil)
            sst.certificado_coordinador_url = archivo_url
            sst.save(update_fields=['certificado_coordinador_url'])
        elif tipo_documento in ['CERTIFICADO_ARL', 'ARL']:
            from apps.empleados.models import EmpleadoSeguridadSocial
            ss, _ = EmpleadoSeguridadSocial.objects.get_or_create(empleado=perfil)
            ss.certificado_arl_url = archivo_url
            ss.save(update_fields=['certificado_arl_url'])
        elif tipo_documento in ['CERTIFICADO_TECNICO', 'CERTIFICADO_MEDICO', 'EXAMEN_MEDICO']:
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
        if tipo in ['CEDULA_FRONTAL', 'CEDULA_POSTERIOR', 'CEDULA']:
            from apps.empleados.permissions import PuedeVerDocumentoIdentidad
            if not PuedeVerDocumentoIdentidad.tiene_acceso(request.user, perfil):
                return Response(
                    {'error': 'No tienes autorización para eliminar documentos de identidad de este colaborador.'},
                    status=status.HTTP_403_FORBIDDEN
                )

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

        # Limpiar referencia en EmpleadoCertificacionesSST o EmpleadoSeguridadSocial
        if tipo in ['CERTIFICADO_ALTURAS', 'ALTURAS']:
            from apps.empleados.models import EmpleadoCertificacionesSST
            sst = EmpleadoCertificacionesSST.objects.filter(empleado=perfil).first()
            if sst:
                sst.certificado_alturas_url = None
                sst.save(update_fields=['certificado_alturas_url'])
        elif tipo in ['CERTIFICADO_COORDINADOR', 'COORDINADOR_ALTURAS', 'COORDINADOR']:
            from apps.empleados.models import EmpleadoCertificacionesSST
            sst = EmpleadoCertificacionesSST.objects.filter(empleado=perfil).first()
            if sst:
                sst.certificado_coordinador_url = None
                sst.save(update_fields=['certificado_coordinador_url'])
        elif tipo in ['CERTIFICADO_ARL', 'ARL']:
            from apps.empleados.models import EmpleadoSeguridadSocial
            ss = EmpleadoSeguridadSocial.objects.filter(empleado=perfil).first()
            if ss:
                ss.certificado_arl_url = None
                ss.save(update_fields=['certificado_arl_url'])
        elif tipo in ['CERTIFICADO_TECNICO', 'CERTIFICADO_MEDICO', 'EXAMEN_MEDICO']:
            from apps.empleados.models import EmpleadoCertificacionesSST
            sst = EmpleadoCertificacionesSST.objects.filter(empleado=perfil).first()
            if sst:
                sst.certificado_tecnico_url = None
                sst.save(update_fields=['certificado_tecnico_url'])

        return Response({'success': True, 'msg': f'Documento {tipo} eliminado correctamente.'})

    @action(detail=True, methods=['get'], url_path='documento-cedula')
    def documento_cedula(self, request, pk=None):
        """
        Descarga o visualización protegida de la copia de la cédula (Habeas Data).
        Requiere permiso 'empleados.ver_cedula', ser superusuario o ser el propio colaborador.
        Registra auditoría en EmpleadoAuditoriaLog de cada acceso al documento sensible.
        Query params:
        - lado: 'frontal' o 'posterior' (por defecto 'frontal')
        - tipo: 'CEDULA_FRONTAL' o 'CEDULA_POSTERIOR'
        """
        import os
        import mimetypes
        from django.http import FileResponse
        from django.conf import settings
        from apps.empleados.permissions import PuedeVerDocumentoIdentidad

        perfil = self.get_object()

        # Validar permiso de Habeas Data
        if not PuedeVerDocumentoIdentidad.tiene_acceso(request.user, perfil):
            return Response(
                {'error': 'Acceso no autorizado por política de confidencialidad y Habeas Data.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Determinar el tipo de documento solicitado
        lado = (request.query_params.get('lado') or '').strip().lower()
        tipo_param = (request.query_params.get('tipo') or '').strip().upper()

        if tipo_param in ['CEDULA_FRONTAL', 'CEDULA_POSTERIOR']:
            tipo_doc = tipo_param
        elif lado in ['posterior', 'reverso', 'trasera', 'atras']:
            tipo_doc = 'CEDULA_POSTERIOR'
        else:
            tipo_doc = 'CEDULA_FRONTAL'

        doc = EmpleadoDocumentoAdjunto.objects.filter(empleado=perfil, tipo_documento=tipo_doc).first()
        if not doc or not doc.archivo_url:
            return Response(
                {'error': f'El documento {tipo_doc} no ha sido cargado en el expediente.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Resolver la ruta física en disco
        rel_path = doc.archivo_url.lstrip('/')
        if rel_path.startswith('media/'):
            rel_path = rel_path[6:]
        ruta_absoluta = os.path.join(settings.MEDIA_ROOT, rel_path)

        if not os.path.exists(ruta_absoluta):
            return Response(
                {'error': 'El archivo físico no se encuentra disponible en el almacenamiento.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Auditoría obligatoria de acceso a documento sensible
        try:
            EmpleadoAuditoriaLog.objects.create(
                empleado=perfil,
                usuario=request.user if request.user and request.user.is_authenticated else None,
                accion='CONSULTA_DOCUMENTO_SENSIBLE',
                tabla_afectada='empleados_documentos_adjuntos',
                datos_anteriores=None,
                datos_nuevos={
                    'tipo_documento': tipo_doc,
                    'archivo_nombre': os.path.basename(ruta_absoluta),
                    'motivo': 'Visualización segura de documento de identidad'
                },
                ip_origen=request.META.get('REMOTE_ADDR')
            )
        except Exception:
            pass

        # Servir el archivo con cabeceras de seguridad
        content_type, _ = mimetypes.guess_type(ruta_absoluta)
        if not content_type:
            content_type = 'application/octet-stream'

        response = FileResponse(open(ruta_absoluta, 'rb'), content_type=content_type)
        response['Content-Disposition'] = f'inline; filename="{os.path.basename(ruta_absoluta)}"'
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control'] = 'private, no-cache, no-store, must-revalidate'
        return response

    @action(detail=False, methods=['get'], url_path='estadisticas')
    def estadisticas(self, request):
        """
        Métricas consolidadas de personal para KPIs globales y contadores de alertas (período de prueba).
        """
        from datetime import timedelta
        from django.utils import timezone
        hoy = timezone.now().date()
        limite = hoy - timedelta(days=62)

        total_activos = EmpleadoPerfil.objects.filter(estado='ACTIVO').count()
        total_formacion = EmpleadoPerfil.objects.filter(estado='EN_FORMACION').count()
        total_inactivos = EmpleadoPerfil.objects.filter(estado='INACTIVO').count()
        total_vehiculo = EmpleadoPerfil.objects.filter(
            movilidad__placa_vehiculo__isnull=False
        ).exclude(movilidad__placa_vehiculo='').count()

        total_prueba = EmpleadoPerfil.objects.filter(
            estado='ACTIVO',
            laboral__fecha_ingreso__gte=limite,
            laboral__fecha_ingreso__lte=hoy
        ).count()

        total_prueba_critica = EmpleadoPerfil.objects.filter(
            estado='ACTIVO',
            laboral__fecha_ingreso__gte=limite,
            laboral__fecha_ingreso__lte=hoy - timedelta(days=47)
        ).count()

        # Métricas de Prácticas SENA (Regla Legacy 2.8)
        aprendices_qs = EmpleadoPerfil.objects.filter(
            estado='ACTIVO'
        ).filter(
            Q(laboral__practica_lectiva_inicio__isnull=False) |
            Q(laboral__practica_lectiva_fin__isnull=False) |
            Q(laboral__practica_productiva_inicio__isnull=False) |
            Q(laboral__practica_productiva_fin__isnull=False) |
            Q(laboral__cargo__icontains='APRENDIZ')
        ).select_related('laboral')

        total_practicas = aprendices_qs.count()
        total_practicas_criticas = 0
        for ap in aprendices_qs:
            dias = ap.laboral.dias_para_fin_practica if hasattr(ap, 'laboral') and ap.laboral else None
            if dias is not None and dias <= 15:
                total_practicas_criticas += 1

        return Response({
            'total': total_activos + total_formacion + total_inactivos,
            'activos': total_activos,
            'en_formacion': total_formacion,
            'inactivos': total_inactivos,
            'con_vehiculo': total_vehiculo,
            'en_prueba': total_prueba,
            'prueba_critica': total_prueba_critica,
            'en_practicas': total_practicas,
            'practicas_criticas': total_practicas_criticas,
        })

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

    @action(detail=False, methods=['get'], url_path='cuadrilla-info')
    def cuadrilla_info(self, request):
        """
        Consulta información operativa de la cuadrilla y del técnico activo asignado (Regla Legacy 2.6).
        Permite auto-completar y validar supervisor, área, carpeta y transporte al vincular un auxiliar a un móvil.
        """
        movil = (request.query_params.get('movil') or '').strip()
        if not movil or 'ASIGNAR' in movil.upper() or 'FUERA DE OPERACION' in movil.upper():
            return Response({'existe_tecnico': False, 'tecnico': None})

        tec_lab = EmpleadoLaboral.objects.filter(
            movil__iexact=movil,
            cargo__icontains='TECNICO',
            empleado__estado='ACTIVO'
        ).select_related('supervisor', 'empleado', 'empleado__movilidad').first()

        if not tec_lab:
            return Response({'existe_tecnico': False, 'tecnico': None})

        tec_mov = getattr(tec_lab.empleado, 'movilidad', None)
        return Response({
            'existe_tecnico': True,
            'tecnico': {
                'id': tec_lab.empleado_id,
                'nombre_completo': tec_lab.empleado.nombre_completo,
                'cargo': tec_lab.cargo,
                'supervisor_id': tec_lab.supervisor_id,
                'supervisor_nombre': tec_lab.supervisor.nombre_completo if tec_lab.supervisor else None,
                'area': tec_lab.area,
                'carpeta': tec_lab.carpeta,
                'medio_transporte': tec_mov.medio_transporte if tec_mov else None,
            }
        })

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser], url_path='subir-foto')
    def subir_foto(self, request, pk=None):
        """
        Carga y actualiza la fotografía de perfil del colaborador (Regla Legacy: save_foto).
        Almacena el archivo en /media/infraestructura/fotos_empleados/{numero_documento}_{timestamp}{ext} y actualiza perfil.foto_url.
        """
        import os
        import time
        from django.conf import settings

        perfil = self.get_object()
        archivo = (
            request.FILES.get('foto') or
            request.FILES.get('file') or
            request.FILES.get('save_foto') or
            request.FILES.get('imagen')
        )
        if not archivo:
            return Response(
                {'error': 'No se proporcionó ningún archivo de imagen.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validar tipo de archivo
        ext = os.path.splitext(archivo.name)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.webp']:
            return Response(
                {'error': 'Formato no válido. Debe ser una imagen en formato JPG, PNG o WebP.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validar tamaño máximo (5MB)
        if archivo.size > 5 * 1024 * 1024:
            return Response(
                {'error': 'El archivo supera el tamaño máximo permitido de 5 MB.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Directorio fotos_empleados dentro de media/infraestructura/
        sub_dir = os.path.join(settings.MEDIA_ROOT, 'infraestructura', 'fotos_empleados')
        os.makedirs(sub_dir, exist_ok=True)

        timestamp = int(time.time())
        nombre_guardado = f"{perfil.numero_documento}_{timestamp}{ext}"
        ruta_absoluta = os.path.join(sub_dir, nombre_guardado)

        with open(ruta_absoluta, 'wb+') as destino:
            for chunk in archivo.chunks():
                destino.write(chunk)

        archivo_url = f"/media/infraestructura/fotos_empleados/{nombre_guardado}"
        foto_anterior = perfil.foto_url

        perfil.foto_url = archivo_url
        perfil.save(update_fields=['foto_url', 'updated_at'])

        # Auditoría
        try:
            EmpleadoWorkflowService.registrar_auditoria(
                empleado=perfil,
                usuario=request.user if request.user.is_authenticated else None,
                accion='ACTUALIZACION',
                tabla_afectada='empleados_perfiles',
                datos_anteriores={'foto_url': foto_anterior},
                datos_nuevos={'foto_url': archivo_url},
                ip_origen=request.META.get('REMOTE_ADDR')
            )
        except Exception:
            pass

        return Response({
            'success': True,
            'message': 'Foto de perfil actualizada exitosamente.',
            'foto_url': archivo_url
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], parser_classes=[MultiPartParser, FormParser, JSONParser], url_path='comprobantes-dotacion')
    def comprobantes_dotacion(self, request, pk=None):
        """
        GET: Lista el historial de comprobantes/actas físicas de entrega de dotación del colaborador.
        POST: Carga un comprobante firmado (PDF o imagen), fecha de entrega y observaciones opcionales.
              (Regla Legacy: guardar_dotacion / name-file_entrega_dotacion).
        """
        import os
        import time
        from datetime import date
        from django.conf import settings

        perfil = self.get_object()

        if request.method == 'GET':
            comprobantes = perfil.comprobantes_dotacion.all().order_by('-fecha_entrega', '-id')
            serializer = EmpleadoDotacionComprobanteSerializer(comprobantes, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # POST: Subida de comprobante
        archivo = (
            request.FILES.get('archivo') or
            request.FILES.get('file') or
            request.FILES.get('name-file_entrega_dotacion')
        )
        if not archivo:
            return Response(
                {'error': 'No se proporcionó ningún archivo de comprobante de dotación.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validar tipo de archivo
        ext = os.path.splitext(archivo.name)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.webp', '.pdf']:
            return Response(
                {'error': 'Formato no soportado. Formatos permitidos: PDF, JPG, PNG o WebP.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validar tamaño máximo (10MB)
        if archivo.size > 10 * 1024 * 1024:
            return Response(
                {'error': 'El archivo supera el tamaño máximo permitido de 10 MB.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Fecha de entrega
        fecha_raw = (
            request.data.get('fecha_entrega') or
            request.data.get('fecha_entrega_dotacion') or
            request.data.get('fecha')
        )
        if fecha_raw:
            try:
                fecha_entrega = date.fromisoformat(str(fecha_raw).strip())
            except (ValueError, TypeError):
                return Response(
                    {'error': 'El formato de fecha de entrega es inválido. Use AAAA-MM-DD.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            fecha_entrega = date.today()

        observaciones = request.data.get('observaciones', '')
        if observaciones:
            observaciones = str(observaciones).strip() or None
        else:
            observaciones = None

        # Guardar archivo en media/infraestructura/dotacion/
        sub_dir = os.path.join(settings.MEDIA_ROOT, 'infraestructura', 'dotacion')
        os.makedirs(sub_dir, exist_ok=True)

        timestamp = int(time.time())
        fecha_str = fecha_entrega.strftime('%Y%m%d')
        nombre_guardado = f"{perfil.numero_documento}_dotacion_{fecha_str}_{timestamp}{ext}"
        ruta_absoluta = os.path.join(sub_dir, nombre_guardado)

        with open(ruta_absoluta, 'wb+') as destino:
            for chunk in archivo.chunks():
                destino.write(chunk)

        archivo_url = f"/media/infraestructura/dotacion/{nombre_guardado}"

        # Determinar usuario responsable de la carga
        subido_por = request.user if (request.user and request.user.is_authenticated) else perfil.user

        comprobante = EmpleadoDotacionComprobante.objects.create(
            empleado=perfil,
            fecha_entrega=fecha_entrega,
            observaciones=observaciones,
            archivo_url=archivo_url,
            subido_por=subido_por,
        )

        # Auditoría
        try:
            EmpleadoAuditoriaLog.objects.create(
                empleado=perfil,
                usuario=request.user if request.user.is_authenticated else None,
                accion='CARGA_COMPROBANTE_DOTACION',
                tabla_afectada='empleados_dotacion_comprobantes',
                datos_nuevos={
                    'id': comprobante.id,
                    'fecha_entrega': str(fecha_entrega),
                    'archivo_url': archivo_url,
                    'observaciones': observaciones,
                },
                ip_origen=request.META.get('REMOTE_ADDR')
            )
        except Exception:
            pass

        return Response(EmpleadoDotacionComprobanteSerializer(comprobante).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'comprobantes-dotacion/(?P<comprobante_id>[^/.]+)')
    def eliminar_comprobante_dotacion(self, request, pk=None, comprobante_id=None):
        """
        Elimina un comprobante físico de dotación y su archivo del servidor.
        """
        import os
        from django.conf import settings

        perfil = self.get_object()
        try:
            comprobante = EmpleadoDotacionComprobante.objects.get(id=comprobante_id, empleado=perfil)
        except EmpleadoDotacionComprobante.DoesNotExist:
            return Response({'error': 'Comprobante de dotación no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        # Eliminar archivo físico en disco
        if comprobante.archivo_url:
            try:
                rel_path = comprobante.archivo_url.lstrip('/')
                if rel_path.startswith('media/'):
                    rel_path = rel_path[6:]
                abs_path = os.path.join(settings.MEDIA_ROOT, rel_path)
                if os.path.exists(abs_path):
                    os.remove(abs_path)
            except Exception:
                pass

        # Auditoría
        try:
            EmpleadoAuditoriaLog.objects.create(
                empleado=perfil,
                usuario=request.user if request.user.is_authenticated else None,
                accion='ELIMINACION_COMPROBANTE_DOTACION',
                tabla_afectada='empleados_dotacion_comprobantes',
                datos_anteriores={
                    'id': comprobante.id,
                    'fecha_entrega': str(comprobante.fecha_entrega),
                    'archivo_url': comprobante.archivo_url,
                },
                ip_origen=request.META.get('REMOTE_ADDR')
            )
        except Exception:
            pass

        comprobante.delete()
        return Response({'detail': 'Comprobante de dotación eliminado exitosamente.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='dotacion-integral')
    def dotacion_integral(self, request, pk=None):
        """
        Consulta unificada del historial de dotación (Punto 2.11):
        1. Comprobantes digitales locales de app-cinco.
        2. Actas históricas firmadas de sst_base_entrega_dotacion (Legacy azul).
        3. Despachos físicos de dotación y EPP desde bodega de Logística.
        """
        perfil = self.get_object()
        datos = EmpleadoWorkflowService.consultar_historial_dotacion_integral(
            empleado_id=perfil.id,
            numero_documento=perfil.numero_documento
        )
        return Response(datos, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='restablecer-contrasena')
    def restablecer_contrasena(self, request, pk=None):
        """
        Genera una clave temporal para el colaborador y audita la acción.
        Regla Legacy: restaurarcontra (línea 2009 de infraestructura_cinco_sas.php).
        """
        perfil = self.get_object()

        # Validación de seguridad: no restablecer superadministradores
        target_user = getattr(perfil, 'user', None)
        if target_user and target_user.is_superuser:
            return Response(
                {'error': 'No está permitido restablecer la contraseña de un superadministrador desde este módulo.'},
                status=status.HTTP_403_FORBIDDEN
            )

        ip_address = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR')

        try:
            resultado = EmpleadoWorkflowService.restablecer_contrasena(
                perfil=perfil,
                operador=request.user,
                ip_origen=ip_address
            )
            return Response(resultado, status=status.HTTP_200_OK)
        except ValidationError as e:
            msg = e.messages[0] if hasattr(e, 'messages') else str(e)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Error al restablecer la contraseña: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


