from datetime import date
from decimal import Decimal
from django.test import TestCase
from unittest.mock import MagicMock, patch

class BaseEmpleadoTestCase(TestCase):
    """
    Clase base para pruebas unitarias del módulo de empleados.
    Limpia automáticamente cualquier usuario y perfil de prueba al finalizar cada test
    para garantizar que la base de datos no quede contaminada con registros efímeros.
    """
    databases = {'default', 'azul'}
    def tearDown(self):
        try:
            from django.contrib.auth.models import User
            from apps.empleados.models import EmpleadoPerfil
            test_users = User.objects.exclude(username__regex=r'^[0-9]+$').filter(is_superuser=False, is_staff=False)
            if test_users.exists():
                EmpleadoPerfil.objects.filter(user__in=test_users).delete()
                test_users.delete()
        except Exception:
            pass
        super().tearDown()


from rest_framework.parsers import FormParser, JSONParser
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from apps.empleados.services.empleado_service import EmpleadoService
from apps.empleados.views.empleado_view import EmpleadoViewSet


class EmpleadoServiceTests(BaseEmpleadoTestCase):
    def test_eliminar_hard_delete_requires_superuser(self):
        instance = MagicMock()
        actor = MagicMock(is_authenticated=True, is_superuser=False)

        result = EmpleadoService.eliminar(
            instance,
            actor_user=actor,
            hard_delete=True,
        )

        self.assertFalse(result)
        instance.delete.assert_not_called()

    def test_eliminar_hard_delete_superuser(self):
        instance = MagicMock()
        actor = MagicMock(is_authenticated=True, is_superuser=True)

        result = EmpleadoService.eliminar(
            instance,
            actor_user=actor,
            hard_delete=True,
        )

        self.assertTrue(result)
        instance.delete.assert_called_once()

    def test_eliminar_soft_delete_changes_estado(self):
        instance = MagicMock(estado="ACTIVO")

        result = EmpleadoService.eliminar(
            instance,
            actor_user=None,
            hard_delete=False,
        )

        self.assertTrue(result)
        self.assertEqual(instance.estado, "INACTIVO")
        instance.save.assert_called_once_with(update_fields=["estado"])

    @patch("apps.empleados.services.empleado_service.Empleado.objects")
    def test_listar_uses_estado_activo_when_missing(self, empleado_objects):
        queryset = MagicMock()
        empleado_objects.filter.return_value = queryset

        EmpleadoService.listar({})

        empleado_objects.filter.assert_called_once_with(estado="ACTIVO")

    @patch("apps.empleados.services.empleado_service.timezone.localdate", return_value=date(2026, 5, 28))
    @patch("apps.empleados.services.empleado_service.EmpleadoService._obtener_registro_siigo_por_cedula")
    def test_construir_contexto_certificado_usa_datos_siigo(self, siigo_lookup, mocked_localdate):
        empleado = MagicMock(
            id=12,
            cedula="123456789",
            nombre="ANA",
            apellido="PEREZ",
            cargo="TECNICO",
            fecha_ingreso=None,
            permiso="",
            pasaporte="",
        )
        siigo_lookup.return_value = MagicMock(
            salario="1750905.00",
            datos={
                "cargo": "009-TECNICOS INSTALACIONES",
                "f_ingreso": "2025-02-04 00:00:00",
                "tipo_contrato": "OBRA Y LABOR",
                "nombre_empleado": "ANA PEREZ",
            },
        )

        context = EmpleadoService.construir_contexto_certificado_laboral(
            empleado=empleado,
            document_type="",
        )

        self.assertEqual(context["nombre_completo"], "ANA PEREZ")
        self.assertEqual(context["cargo"], "TECNICOS INSTALACIONES")
        self.assertEqual(context["document_type"], "CC")
        self.assertEqual(context["document_type_label"], "CC")
        self.assertEqual(context["salario"], Decimal("1750905.00"))
        self.assertEqual(context["salario_texto"], "$1.750.905")
        self.assertEqual(context["fecha_ingreso"], date(2025, 2, 4))
        self.assertEqual(context["fecha_expedicion"], date(2026, 5, 28))
        self.assertEqual(context["fecha_expedicion_texto"], "28/05/2026")
        self.assertEqual(context["contrato"], "Obra y labor")

    @patch("apps.empleados.services.empleado_service.EmpleadoService._obtener_registro_siigo_por_cedula")
    def test_construir_contexto_certificado_permiso_infiere_pt(self, siigo_lookup):
        empleado = MagicMock(
            id=21,
            cedula="99887766",
            nombre="LUIS",
            apellido="GOMEZ",
            cargo="AUXILIAR",
            fecha_ingreso=date(2024, 1, 15),
            permiso="PEP123",
            pasaporte="",
        )
        siigo_lookup.return_value = None

        context = EmpleadoService.construir_contexto_certificado_laboral(empleado=empleado)

        self.assertEqual(context["document_type"], "PT")
        self.assertEqual(context["document_type_label"], "PT")
        self.assertTrue(context["document_flags"]["PT"])

    def test_normalize_contract_value_fixes_broken_accents(self):
        contract = EmpleadoService._normalize_contract_value("T?rmino Indefinido.")

        self.assertEqual(contract, "Término indefinido")

    @patch("apps.empleados.services.empleado_service.EmpleadoService._obtener_registro_siigo_por_cedula")
    def test_generar_certificado_laboral_pdf_real(self, siigo_lookup):
        empleado = MagicMock(
            id=12,
            cedula="123456789",
            nombre="ANA",
            apellido="PEREZ",
            cargo="TECNICO",
            fecha_ingreso=date(2025, 2, 4),
            permiso="",
            pasaporte="",
        )
        siigo_lookup.return_value = MagicMock(
            salario="1750905.00",
            datos={
                "cargo": "009-TECNICOS INSTALACIONES",
                "f_ingreso": "2025-02-04 00:00:00",
                "tipo_contrato": "OBRA Y LABOR",
                "nombre_empleado": "ANA PEREZ",
            },
        )

        result = EmpleadoService.generar_certificado_laboral(
            empleado=empleado,
            document_type="CC",
        )

        self.assertTrue(result["filename"].startswith("certificado_laboral_"))
        self.assertTrue(result["filename"].endswith(".pdf"))
        self.assertEqual(len(result["filename"]), 60)
        self.assertTrue(result["content"].startswith(b"%PDF"))
        self.assertEqual(result["context"]["nombre_completo"], "ANA PEREZ")
        self.assertEqual(result["context"]["cargo"], "TECNICOS INSTALACIONES")
        self.assertEqual(result["context"]["contrato"], "Obra y labor")
        self.assertTrue(result["context"]["is_activo"])

    @patch("apps.empleados.services.empleado_service.timezone.localdate")
    @patch("apps.empleados.services.empleado_service.EmpleadoService._obtener_registro_siigo_por_cedula")
    def test_generar_certificado_laboral_pdf_inactivo(self, siigo_lookup, mock_localdate):
        mock_localdate.return_value = date(2026, 7, 2)
        empleado = MagicMock(
            id=15,
            cedula="1038435140",
            nombre="JHON HENRY",
            apellido="RODRIGUEZ VILLA",
            cargo="TECNICO INSTALACIONES",
            estado="INACTIVO",
            fecha_ingreso=date(2025, 9, 12),
            fecha_egreso=date(2025, 10, 27),
            permiso="",
            pasaporte="",
        )
        siigo_lookup.return_value = MagicMock(
            salario="1423500.00",
            datos={
                "cargo": "TECNICO INSTALACIONES",
                "f_ingreso": "2025-09-12 00:00:00",
                "f_egreso": "2025-10-27 00:00:00",
                "tipo_contrato": "OBRA Y LABOR",
                "nombre_empleado": "JHON HENRY RODRIGUEZ VILLA",
            },
        )

        result = EmpleadoService.generar_certificado_laboral(
            empleado=empleado,
            document_type="CC",
        )

        self.assertFalse(result["context"]["is_activo"])
        self.assertEqual(result["context"]["fecha_egreso_texto"], "27/10/2025")
        self.assertEqual(result["context"]["fecha_expedicion_texto_largo"], "02 DE JULIO DE 2026")
        self.assertTrue(result["content"].startswith(b"%PDF"))

    @patch("apps.empleados.services.empleado_service.EmpleadoService._obtener_registro_siigo_por_cedula")
    def test_generar_certificado_laboral_error_si_no_hay_datos_siigo(self, siigo_lookup):
        empleado = MagicMock(
            id=12,
            cedula="123456789",
            nombre="ANA",
            apellido="PEREZ",
            cargo="TECNICO",
            fecha_ingreso=date(2025, 2, 4),
            permiso="",
            pasaporte="",
        )
        siigo_lookup.return_value = None

        with self.assertRaises(ValueError) as context:
            EmpleadoService.generar_certificado_laboral(
                empleado=empleado,
                document_type="CC",
            )
        self.assertIn("No se encontró información del empleado en SIIGO", str(context.exception))

    @patch("apps.empleados.services.empleado_service.EmpleadoService._obtener_registro_siigo_por_cedula")
    def test_generar_certificado_laboral_con_datos_manuales_sin_siigo(self, siigo_lookup):
        empleado = MagicMock(
            id=12,
            cedula="123456789",
            nombre="MARIA",
            apellido="LOPEZ",
            cargo="",
            fecha_ingreso=None,
            permiso="",
            pasaporte="",
        )
        siigo_lookup.return_value = None

        manual_data = {
            "salario": "2500000",
            "tipo_contrato": "Término indefinido",
            "cargo": "DESARROLLADOR",
            "fecha_ingreso": "2024-01-10",
        }

        result = EmpleadoService.generar_certificado_laboral(
            empleado=empleado,
            document_type="CC",
            manual_data=manual_data,
        )

        self.assertTrue(result["content"].startswith(b"%PDF"))
        self.assertEqual(result["context"]["salario_texto"], "$2.500.000")
        self.assertEqual(result["context"]["contrato"], "Término indefinido")
        self.assertEqual(result["context"]["cargo"], "DESARROLLADOR")

    @patch("apps.empleados.services.empleado_service.EmpleadoService._obtener_registro_siigo_por_cedula")
    def test_generar_certificado_laboral_pdf_femenino(self, siigo_lookup):
        empleado = MagicMock(
            id=15,
            cedula="987654321",
            nombre="MARIA",
            apellido="GARCIA",
            cargo="ANALISTA",
            fecha_ingreso=date(2024, 5, 10),
            genero="FEMENINO",
            permiso="",
            pasaporte="",
        )
        siigo_lookup.return_value = MagicMock(
            salario="3000000",
            datos={"tipo_contrato": "Término indefinido"},
        )

        result = EmpleadoService.generar_certificado_laboral(
            empleado=empleado,
            document_type="CC",
        )

        self.assertEqual(result["context"]["genero"], "F")
        self.assertTrue(result["content"].startswith(b"%PDF"))

    @patch("apps.empleados.services.empleado_service.EmpleadoService._obtener_registro_siigo_por_cedula")
    def test_generar_certificado_laboral_pdf_con_auxilio_menor_2_smlv(self, siigo_lookup):
        empleado = MagicMock(
            id=15,
            cedula="987654321",
            nombre="MARIA",
            apellido="GARCIA",
            cargo="ANALISTA",
            fecha_ingreso=date(2024, 5, 10),
            genero="FEMENINO",
            permiso="",
            pasaporte="",
        )
        siigo_lookup.return_value = MagicMock(
            salario="1750905",
            datos={"tipo_contrato": "Término indefinido"},
        )

        result = EmpleadoService.generar_certificado_laboral(
            empleado=empleado,
            document_type="CC",
        )

        self.assertTrue(result["content"].startswith(b"%PDF"))
        self.assertEqual(result["context"]["salario"], Decimal("1750905"))

    @patch("apps.empleados.services.empleado_service.EmpleadoService._obtener_registro_siigo_por_cedula")
    def test_generar_certificado_laboral_pdf_sin_auxilio_mayor_2_smlv(self, siigo_lookup):
        empleado = MagicMock(
            id=15,
            cedula="987654321",
            nombre="MARIA",
            apellido="GARCIA",
            cargo="ANALISTA",
            fecha_ingreso=date(2024, 5, 10),
            genero="FEMENINO",
            permiso="",
            pasaporte="",
        )
        siigo_lookup.return_value = MagicMock(
            salario="4000000",
            datos={"tipo_contrato": "Término indefinido"},
        )

        result = EmpleadoService.generar_certificado_laboral(
            empleado=empleado,
            document_type="CC",
        )

        self.assertTrue(result["content"].startswith(b"%PDF"))
        self.assertEqual(result["context"]["salario"], Decimal("4000000"))


class EmpleadoViewSetTests(BaseEmpleadoTestCase):
    @patch("apps.empleados.views.empleado_view.EmpleadoService.generar_certificado_laboral")
    def test_certificado_laboral_retorna_pdf(self, generate_certificate):
        generate_certificate.return_value = {
            "filename": "certificado_laboral_123.pdf",
            "content": b"%PDF-1.4",
            "context": {"cedula": "123"},
        }
        request = APIRequestFactory().get(
            "/empleados/empleados/1/certificado-laboral/",
            {
                "document_type": "CC",
            },
        )
        request = Request(request)
        view = EmpleadoViewSet()
        empleado = MagicMock()

        with patch.object(EmpleadoViewSet, "get_object", return_value=empleado):
            response = view.certificado_laboral(request, pk="1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn('attachment; filename="certificado_laboral_123.pdf"', response["Content-Disposition"])
        self.assertEqual(response.content, b"%PDF-1.4")

    @patch("apps.empleados.views.empleado_view.EmpleadoService.generar_certificado_laboral")
    def test_certificado_laboral_post_con_datos_manuales(self, generate_certificate):
        generate_certificate.return_value = {
            "filename": "certificado_laboral_456.pdf",
            "content": b"%PDF-1.4",
            "context": {"cedula": "456"},
        }
        payload = {
            "document_type": "CC",
            "salario": "1800000",
            "tipo_contrato": "OBRA Y LABOR",
        }
        request = APIRequestFactory().post(
            "/empleados/empleados/1/certificado-laboral/",
            payload,
            format="json",
        )
        request = Request(request, parsers=[JSONParser(), FormParser()])
        view = EmpleadoViewSet()
        empleado = MagicMock()

        with patch.object(EmpleadoViewSet, "get_object", return_value=empleado):
            response = view.certificado_laboral(request, pk="1")

        self.assertEqual(response.status_code, 200)
        generate_certificate.assert_called_once_with(
            empleado=empleado,
            document_type="CC",
            manual_data={"salario": "1800000", "tipo_contrato": "OBRA Y LABOR"},
        )

    @patch("apps.security.models.CertificadoFirmaConfig.objects")
    def test_certificado_config_endpoints_get(self, mock_config_objects):
        mock_config = MagicMock(
            firmante_nombre="JEFE PRUEBA",
            firmante_cargo="CARGO PRUEBA",
            firma_imagen_nombre="firma_prueba.png"
        )
        mock_config_objects.first.return_value = mock_config
        
        request = APIRequestFactory().get("/empleados/empleados/certificado-config/")
        request.user = MagicMock(is_authenticated=True, is_superuser=True)
        
        view = EmpleadoViewSet()
        response = view.get_certificado_config(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["firmante_nombre"], "JEFE PRUEBA")
        self.assertEqual(response.data["firmante_cargo"], "CARGO PRUEBA")
        self.assertEqual(response.data["firma_imagen_nombre"], "firma_prueba.png")
        self.assertTrue(response.data["can_edit"])

    @patch("apps.security.models.CertificadoFirmaConfig.objects")
    def test_certificado_config_endpoints_update_forbidden(self, mock_config_objects):
        request = APIRequestFactory().post("/empleados/empleados/certificado-config/update/", {
            "firmante_nombre": "OTRO JEFE",
            "firmante_cargo": "OTRO CARGO"
        })
        user = MagicMock(is_authenticated=True, is_superuser=False, username="user1")
        request.user = user
        
        with patch("apps.empleados.views.empleado_view.Empleado.objects.filter") as mock_emp_filter:
            mock_emp_filter.return_value.first.return_value = MagicMock(area="MANTENIMIENTO", carpeta="MANTENIMIENTO")
            view = EmpleadoViewSet()
            response = view.update_certificado_config(request)
            
        self.assertEqual(response.status_code, 403)


class EmpleadoContactoPerfilUpdateTests(BaseEmpleadoTestCase):
    def test_actualizar_contacto_con_campos_completos_y_auditoria(self):
        from rest_framework.test import APIRequestFactory
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil, EmpleadoContacto, EmpleadoAuditoriaLog
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoPerfilDetailSerializer

        import uuid
        User = get_user_model()
        uid = uuid.uuid4().hex[:8]
        user = User.objects.create_user(username=f'usr_cnt_{uid}', email=f'cnt_{uid}@cinco.com', password='pwd')
        perfil = EmpleadoPerfil.objects.create(
            user=user,
            numero_documento=f'99{uid[:7]}',
            tipo_documento='CC',
            nombres='CARLOS',
            apellidos='GOMEZ'
        )
        contacto = EmpleadoContacto.objects.create(
            empleado=perfil,
            celular_personal='3001112233',
            celular_corporativo='3112223344',
            correo_personal='carlos@gmail.com'
        )

        factory = APIRequestFactory()
        http_request = factory.patch('/empleados/perfiles/{}/'.format(perfil.id), {})
        http_request.user = user
        http_request.META['REMOTE_ADDR'] = '127.0.0.1'

        serializer = EmpleadoPerfilDetailSerializer(
            instance=perfil,
            data={
                'contacto': {
                    'celular_alterno': '3159998877',
                    'telefono_fijo': '6042345678',
                    'claro_pay': 'CLARO-PAY-12345',
                    'correo_personal': 'carlos.gomez@gmail.com',
                    'direccion_residencia': 'Cra 45 # 10-20'
                }
            },
            partial=True,
            context={'request': http_request}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        contacto.refresh_from_db()
        self.assertEqual(contacto.celular_alterno, '3159998877')
        self.assertEqual(contacto.telefono_fijo, '6042345678')
        self.assertEqual(contacto.claro_pay, 'CLARO-PAY-12345')
        self.assertEqual(contacto.direccion_residencia, 'Cra 45 # 10-20')
        self.assertEqual(contacto.correo_personal, 'carlos.gomez@gmail.com')

        # Verificar auditoria
        log = EmpleadoAuditoriaLog.objects.filter(empleado=perfil, accion='ACTUALIZACION_CONTACTO').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.tabla_afectada, 'empleados_contacto')
        self.assertIn('3159998877', str(log.datos_nuevos))
        self.assertIn('CLARO-PAY-12345', str(log.datos_nuevos))

        # Cleanup
        log.delete()
        contacto.delete()
        perfil.delete()
        user.delete()


class EmpleadoCertificacionesSSTTests(BaseEmpleadoTestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil, EmpleadoCertificacionesSST
        import uuid
        User = get_user_model()
        uid = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(username=f'usr_sst_{uid}', email=f'sst_{uid}@cinco.com', password='pwd')
        self.perfil = EmpleadoPerfil.objects.create(
            user=self.user,
            numero_documento=f'88{uid[:7]}',
            tipo_documento='CC',
            nombres='LAURA',
            apellidos='VALENCIA'
        )

    def test_actualizar_certificaciones_sst_y_auditoria(self):
        from rest_framework.test import APIRequestFactory
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoPerfilDetailSerializer
        from apps.empleados.models import EmpleadoCertificacionesSST, EmpleadoAuditoriaLog

        factory = APIRequestFactory()
        http_request = factory.patch(f'/empleados/perfiles/{self.perfil.id}/', {})
        http_request.user = self.user
        http_request.META['REMOTE_ADDR'] = '127.0.0.1'

        serializer = EmpleadoPerfilDetailSerializer(
            instance=self.perfil,
            data={
                'certificaciones_sst': {
                    'permiso_trabajo': 'AUTORIZADO ALTURAS',
                    'vencimiento_alturas': '2027-12-31',
                    'vencimiento_tecnico': '2026-11-15',
                    'certificado_alturas_url': '/media/documentos_empleados/test_alturas.pdf',
                    'certificado_tecnico_url': '/media/documentos_empleados/test_medico.pdf',
                }
            },
            partial=True,
            context={'request': http_request}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        sst = EmpleadoCertificacionesSST.objects.get(empleado=self.perfil)
        self.assertEqual(sst.permiso_trabajo, 'AUTORIZADO ALTURAS')
        self.assertEqual(str(sst.vencimiento_alturas), '2027-12-31')
        self.assertEqual(str(sst.vencimiento_tecnico), '2026-11-15')
        self.assertEqual(sst.certificado_alturas_url, '/media/documentos_empleados/test_alturas.pdf')
        self.assertEqual(sst.certificado_tecnico_url, '/media/documentos_empleados/test_medico.pdf')
        self.assertEqual(sst.estado_alturas, 'VIGENTE')

        # Verificar log de auditoría
        log = EmpleadoAuditoriaLog.objects.filter(
            empleado=self.perfil,
            accion='ACTUALIZACION_SST',
            tabla_afectada='empleados_certificaciones_sst'
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.usuario, self.user)

    def test_subir_y_eliminar_documento_sst(self):
        from rest_framework.test import APIRequestFactory, force_authenticate
        from django.core.files.uploadedfile import SimpleUploadedFile
        from apps.empleados.views.empleado_perfil_view import EmpleadoPerfilViewSet
        from apps.empleados.models import EmpleadoCertificacionesSST, EmpleadoDocumentoAdjunto

        pdf_alturas = SimpleUploadedFile("curso_alturas.pdf", b"%PDF-1.4 alturas test content", content_type="application/pdf")
        pdf_medico = SimpleUploadedFile("examen_medico.pdf", b"%PDF-1.4 medico test content", content_type="application/pdf")

        view = EmpleadoPerfilViewSet.as_view({'post': 'subir_documento', 'delete': 'eliminar_documento'})
        factory = APIRequestFactory()

        # 1. Subir Certificado Alturas
        req_alturas = factory.post(
            f'/empleados/perfiles/{self.perfil.id}/subir-documento/',
            {'tipo_documento': 'CERTIFICADO_ALTURAS', 'archivo': pdf_alturas},
            format='multipart'
        )
        force_authenticate(req_alturas, user=self.user)
        resp1 = view(req_alturas, pk=self.perfil.id)
        self.assertEqual(resp1.status_code, 200)

        sst = EmpleadoCertificacionesSST.objects.get(empleado=self.perfil)
        self.assertTrue(sst.certificado_alturas_url.startswith('/media/infraestructura/alturas/'))
        self.assertTrue(sst.certificado_alturas_url.endswith('.pdf'))

        # 2. Subir Soporte Médico / Técnico
        req_medico = factory.post(
            f'/empleados/perfiles/{self.perfil.id}/subir-documento/',
            {'tipo_documento': 'CERTIFICADO_TECNICO', 'archivo': pdf_medico},
            format='multipart'
        )
        force_authenticate(req_medico, user=self.user)
        resp2 = view(req_medico, pk=self.perfil.id)
        self.assertEqual(resp2.status_code, 200)

        sst.refresh_from_db()
        self.assertTrue(sst.certificado_tecnico_url.startswith('/media/infraestructura/examenes_medicos/'))

        # 3. Subir Certificado Coordinador Alturas
        pdf_coordinador = SimpleUploadedFile("coordinador.pdf", b"%PDF-1.4 coordinador test content", content_type="application/pdf")
        req_coord = factory.post(
            f'/empleados/perfiles/{self.perfil.id}/subir-documento/',
            {'tipo_documento': 'CERTIFICADO_COORDINADOR', 'archivo': pdf_coordinador},
            format='multipart'
        )
        force_authenticate(req_coord, user=self.user)
        resp_coord = view(req_coord, pk=self.perfil.id)
        self.assertEqual(resp_coord.status_code, 200)

        sst.refresh_from_db()
        self.assertTrue(sst.certificado_coordinador_url.startswith('/media/infraestructura/alturas/'))
        self.assertTrue(sst.certificado_coordinador_url.endswith('.pdf'))

        # 4. Subir Certificado ARL
        from apps.empleados.models import EmpleadoSeguridadSocial
        pdf_arl = SimpleUploadedFile("afiliacion_arl.pdf", b"%PDF-1.4 arl test content", content_type="application/pdf")
        req_arl = factory.post(
            f'/empleados/perfiles/{self.perfil.id}/subir-documento/',
            {'tipo_documento': 'CERTIFICADO_ARL', 'archivo': pdf_arl},
            format='multipart'
        )
        force_authenticate(req_arl, user=self.user)
        resp_arl = view(req_arl, pk=self.perfil.id)
        self.assertEqual(resp_arl.status_code, 200)

        ss = EmpleadoSeguridadSocial.objects.get(empleado=self.perfil)
        self.assertTrue(ss.certificado_arl_url.startswith('/media/infraestructura/arl/'))
        self.assertTrue(ss.certificado_arl_url.endswith('.pdf'))

        # 5. Eliminar Certificado Alturas
        req_del = factory.delete(f'/empleados/perfiles/{self.perfil.id}/documentos/CERTIFICADO_ALTURAS/')
        force_authenticate(req_del, user=self.user)
        resp3 = view(req_del, pk=self.perfil.id, tipo_documento='CERTIFICADO_ALTURAS')
        self.assertEqual(resp3.status_code, 200)

        sst.refresh_from_db()
        self.assertIsNone(sst.certificado_alturas_url)

        # 6. Eliminar Certificado Coordinador
        req_del_coord = factory.delete(f'/empleados/perfiles/{self.perfil.id}/documentos/CERTIFICADO_COORDINADOR/')
        force_authenticate(req_del_coord, user=self.user)
        resp_del_coord = view(req_del_coord, pk=self.perfil.id, tipo_documento='CERTIFICADO_COORDINADOR')
        self.assertEqual(resp_del_coord.status_code, 200)
        sst.refresh_from_db()
        self.assertIsNone(sst.certificado_coordinador_url)

        # 7. Eliminar Certificado ARL
        req_del_arl = factory.delete(f'/empleados/perfiles/{self.perfil.id}/documentos/CERTIFICADO_ARL/')
        force_authenticate(req_del_arl, user=self.user)
        resp_del_arl = view(req_del_arl, pk=self.perfil.id, tipo_documento='CERTIFICADO_ARL')
        self.assertEqual(resp_del_arl.status_code, 200)
        ss.refresh_from_db()
        self.assertIsNone(ss.certificado_arl_url)


class EmpleadoDotacionActivosTests(BaseEmpleadoTestCase):
    def test_actualizar_dotacion_con_guerrera_y_seriales(self):
        from rest_framework.test import APIRequestFactory
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil, EmpleadoDotacionActivos, EmpleadoAuditoriaLog
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoPerfilDetailSerializer
        import uuid

        User = get_user_model()
        uid = uuid.uuid4().hex[:8]
        user = User.objects.create_user(username=f'usr_dot_{uid}', email=f'dot_{uid}@cinco.com', password='pwd')
        perfil = EmpleadoPerfil.objects.create(
            user=user,
            numero_documento=f'77{uid[:7]}',
            tipo_documento='CC',
            nombres='DIEGO',
            apellidos='RAMIREZ'
        )

        factory = APIRequestFactory()
        http_request = factory.patch(f'/empleados/perfiles/{perfil.id}/', {})
        http_request.user = user
        http_request.META['REMOTE_ADDR'] = '127.0.0.1'

        serializer = EmpleadoPerfilDetailSerializer(
            instance=perfil,
            data={
                'dotacion_activos': {
                    'talla_camisa': 'L',
                    'talla_pantalon': '34',
                    'talla_calzado': '42',
                    'talla_chaqueta': 'L',
                    'talla_guerrera': 'XL',
                    'tiene_carnet': True,
                    'fecha_entrega_carnet': '2026-03-15',
                }
            },
            partial=True,
            context={'request': http_request}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        dot = EmpleadoDotacionActivos.objects.get(empleado=perfil)
        self.assertEqual(dot.talla_guerrera, 'XL')
        self.assertEqual(dot.talla_camisa, 'L')
        self.assertEqual(dot.talla_pantalon, '34')
        self.assertEqual(dot.talla_calzado, '42')
        self.assertEqual(dot.talla_chaqueta, 'L')
        self.assertTrue(dot.tiene_carnet)
        self.assertEqual(str(dot.fecha_entrega_carnet), '2026-03-15')

        # Verificar auditoría
        log = EmpleadoAuditoriaLog.objects.filter(
            empleado=perfil,
            accion='ACTUALIZACION_DOTACION',
            tabla_afectada='empleados_dotacion_activos'
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.datos_nuevos.get('talla_guerrera'), 'XL')


class EmpleadoMovilidadTests(BaseEmpleadoTestCase):
    def test_actualizar_movilidad_perfil_y_auditoria(self):
        from rest_framework.test import APIRequestFactory
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil, EmpleadoMovilidad, EmpleadoAuditoriaLog
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoPerfilDetailSerializer
        import uuid

        User = get_user_model()
        uid = uuid.uuid4().hex[:8]
        user = User.objects.create_user(username=f'usr_mov_{uid}', email=f'mov_{uid}@cinco.com', password='pwd')
        perfil = EmpleadoPerfil.objects.create(
            user=user,
            numero_documento=f'66{uid[:7]}',
            tipo_documento='CC',
            nombres='LUIS',
            apellidos='MARTINEZ'
        )

        factory = APIRequestFactory()
        http_request = factory.patch(f'/empleados/perfiles/{perfil.id}/', {})
        http_request.user = user
        http_request.META['REMOTE_ADDR'] = '127.0.0.1'

        serializer = EmpleadoPerfilDetailSerializer(
            instance=perfil,
            data={
                'movilidad': {
                    'sabe_conducir': True,
                    'medio_transporte': 'MOTO',
                    'modelo_vehiculo': 'Yamaha XTZ 150',
                    'placa_vehiculo': 'ABC12D',
                }
            },
            partial=True,
            context={'request': http_request}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        mov = EmpleadoMovilidad.objects.get(empleado=perfil)
        self.assertTrue(mov.sabe_conducir)
        self.assertEqual(mov.medio_transporte, 'MOTO')
        self.assertEqual(mov.modelo_vehiculo, 'Yamaha XTZ 150')
        self.assertEqual(mov.placa_vehiculo, 'ABC12D')

        # Verificar auditoría
        log = EmpleadoAuditoriaLog.objects.filter(
            empleado=perfil,
            accion='ACTUALIZACION_MOVILIDAD',
            tabla_afectada='empleados_movilidad'
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.datos_nuevos.get('placa_vehiculo'), 'ABC12D')
        self.assertEqual(log.datos_nuevos.get('medio_transporte'), 'MOTO')

    def test_exclusividad_placa_entre_empleados(self):
        from rest_framework.test import APIRequestFactory
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil, EmpleadoMovilidad, EmpleadoAuditoriaLog
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoPerfilDetailSerializer
        import uuid

        User = get_user_model()
        uid1 = uuid.uuid4().hex[:8]
        uid2 = uuid.uuid4().hex[:8]
        user1 = User.objects.create_user(username=f'usr_exc_{uid1}', email=f'exc_{uid1}@cinco.com', password='pwd')
        user2 = User.objects.create_user(username=f'usr_exc_{uid2}', email=f'exc_{uid2}@cinco.com', password='pwd')
        p1 = EmpleadoPerfil.objects.create(user=user1, numero_documento=f'55{uid1[:7]}', nombres='EMP1', apellidos='UNO')
        p2 = EmpleadoPerfil.objects.create(user=user2, numero_documento=f'55{uid2[:7]}', nombres='EMP2', apellidos='DOS')

        factory = APIRequestFactory()
        req = factory.patch('/test/', {})
        req.user = user1
        req.META['REMOTE_ADDR'] = '127.0.0.1'

        # Asignar placa KLR650 a p1
        s1 = EmpleadoPerfilDetailSerializer(instance=p1, data={'movilidad': {'placa_vehiculo': 'KLR650'}}, partial=True, context={'request': req})
        self.assertTrue(s1.is_valid())
        s1.save()

        m1 = EmpleadoMovilidad.objects.get(empleado=p1)
        self.assertEqual(m1.placa_vehiculo, 'KLR650')

        # Asignar la misma placa KLR650 a p2 -> p1 debe quedar sin placa
        s2 = EmpleadoPerfilDetailSerializer(instance=p2, data={'movilidad': {'placa_vehiculo': 'KLR650'}}, partial=True, context={'request': req})
        self.assertTrue(s2.is_valid())
        s2.save()

        m1.refresh_from_db()
        m2 = EmpleadoMovilidad.objects.get(empleado=p2)
        self.assertIsNone(m1.placa_vehiculo)
        self.assertEqual(m2.placa_vehiculo, 'KLR650')

        # Verificar log LIBERACION_PLACA en p1
        log_lib = EmpleadoAuditoriaLog.objects.filter(empleado=p1, accion='LIBERACION_PLACA').first()
        self.assertIsNotNone(log_lib)


class EmpleadoContactoEmergenciaTests(BaseEmpleadoTestCase):
    def test_gestionar_y_eliminar_contacto_emergencia(self):
        from rest_framework.test import APIRequestFactory
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil, EmpleadoContactoEmergencia, EmpleadoAuditoriaLog
        from apps.empleados.services.empleado_workflow_service import EmpleadoWorkflowService
        import uuid

        User = get_user_model()
        uid = uuid.uuid4().hex[:8]
        user = User.objects.create_user(username=f'usr_eme_{uid}', email=f'eme_{uid}@cinco.com', password='pwd')
        perfil = EmpleadoPerfil.objects.create(
            user=user,
            numero_documento=f'44{uid[:7]}',
            tipo_documento='CC',
            nombres='MARIA',
            apellidos='LOPEZ'
        )

        # 1. Crear primer contacto no principal
        c1 = EmpleadoWorkflowService.gestionar_contacto_emergencia(
            empleado_id=perfil.id,
            nombre_completo='JUAN LOPEZ',
            parentesco='PADRE',
            telefono='3001112233',
            es_principal=False,
            user_operator=user,
            ip_address='127.0.0.1'
        )
        self.assertEqual(c1.nombre_completo, 'JUAN LOPEZ')
        self.assertEqual(c1.parentesco, 'PADRE')
        self.assertFalse(c1.es_principal)

        # 2. Crear segundo contacto principal
        c2 = EmpleadoWorkflowService.gestionar_contacto_emergencia(
            empleado_id=perfil.id,
            nombre_completo='ANA GOMEZ',
            parentesco='MADRE',
            telefono='3119998877',
            es_principal=True,
            user_operator=user,
            ip_address='127.0.0.1'
        )
        self.assertTrue(c2.es_principal)

        # 3. Marcar c1 como principal -> c2 debe perder es_principal
        c1_updated = EmpleadoWorkflowService.gestionar_contacto_emergencia(
            empleado_id=perfil.id,
            contacto_id=c1.id,
            nombre_completo='JUAN LOPEZ PEREZ',
            parentesco='PADRE',
            telefono='3001112233',
            es_principal=True,
            user_operator=user,
            ip_address='127.0.0.1'
        )
        self.assertTrue(c1_updated.es_principal)
        c2.refresh_from_db()
        self.assertFalse(c2.es_principal)

        # 4. Eliminar c2
        EmpleadoWorkflowService.eliminar_contacto_emergencia(
            empleado_id=perfil.id,
            contacto_id=c2.id,
            user_operator=user,
            ip_address='127.0.0.1'
        )
        self.assertFalse(EmpleadoContactoEmergencia.objects.filter(id=c2.id).exists())

        # 5. Verificar auditoría
        log_del = EmpleadoAuditoriaLog.objects.filter(
            empleado=perfil,
            accion='ELIMINACION_CONTACTO_EMERGENCIA'
        ).first()
        self.assertIsNotNone(log_del)


class EmpleadoDesactivacionCuadrillaTiranTests(BaseEmpleadoTestCase):
    def test_desactivar_tecnico_desvincula_auxiliares_de_cuadrilla_tiran(self):
        """
        Regla Legacy PHP: Lineas 667-687 de infraestructura_cinco_sas.php
        Al desactivar a un TECNICO asignado a una movil TIRAN, si no queda ningun otro
        tecnico activo en la cuadrilla, todos los auxiliares activos en esa movil
        se desvinculan a '1 - SIN ASIGNAR' y se genera auditoria.
        """
        import uuid
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral, EmpleadoAuditoriaLog
        from apps.empleados.services.empleado_workflow_service import EmpleadoWorkflowService

        User = get_user_model()
        uid_op = uuid.uuid4().hex[:6]
        user_op = User.objects.create_user(username=f'op_{uid_op}', email=f'op_{uid_op}@cinco.com', password='pwd')

        movil_tiran = f'TIRAN_{uuid.uuid4().hex[:6]}'

        # 1. Crear Tecnico 1 en cuadrilla TIRAN
        uid_t1 = uuid.uuid4().hex[:6]
        user_t1 = User.objects.create_user(username=f't1_{uid_t1}', email=f't1_{uid_t1}@cinco.com', password='pwd')
        p_t1 = EmpleadoPerfil.objects.create(user=user_t1, numero_documento=f'91{uid_t1}', tipo_documento='CC', nombres='CARLOS', apellidos='TECNICO', estado='ACTIVO')
        lab_t1 = EmpleadoLaboral.objects.create(fecha_ingreso=date(2024, 1, 1), empleado=p_t1, cargo='TECNICO', movil=movil_tiran, area='OPERACIONES', carpeta='OPERACIONES')

        # 2. Crear Auxiliar en cuadrilla TIRAN
        uid_a1 = uuid.uuid4().hex[:6]
        user_a1 = User.objects.create_user(username=f'a1_{uid_a1}', email=f'a1_{uid_a1}@cinco.com', password='pwd')
        p_a1 = EmpleadoPerfil.objects.create(user=user_a1, numero_documento=f'92{uid_a1}', tipo_documento='CC', nombres='PEDRO', apellidos='AUXILIAR', estado='ACTIVO')
        lab_a1 = EmpleadoLaboral.objects.create(fecha_ingreso=date(2024, 1, 1), empleado=p_a1, cargo='AUXILIAR', movil=movil_tiran, area='OPERACIONES', carpeta='OPERACIONES')

        # 3. Desactivar Tecnico 1
        perfil_desc = EmpleadoWorkflowService.desactivar_empleado(
            empleado_id=p_t1.id,
            fecha_egreso='2026-10-30',
            motivo='RENUNCIA VOLUNTARIA',
            motivo_real='MEJOR OFERTA',
            user_operator=user_op,
            ip_address='127.0.0.1'
        )

        # 4. Validar que el tecnico esta INACTIVO con movil 'Z - FUERA DE OPERACION'
        p_t1.refresh_from_db()
        lab_t1.refresh_from_db()
        self.assertEqual(p_t1.estado, 'INACTIVO')
        self.assertFalse(p_t1.user.is_active)
        self.assertEqual(lab_t1.movil, 'Z - FUERA DE OPERACION')

        # 5. Validar que el auxiliar fue automaticamente desvinculado a '1 - SIN ASIGNAR'
        lab_a1.refresh_from_db()
        self.assertEqual(lab_a1.movil, '1 - SIN ASIGNAR')

        # 6. Validar que se retorno la lista de auxiliares desvinculados
        self.assertEqual(len(perfil_desc.auxiliares_desvinculados), 1)
        self.assertEqual(perfil_desc.auxiliares_desvinculados[0]['id'], p_a1.id)

        # 7. Validar auditoria de desvinculacion automatica en el auxiliar
        log_aux = EmpleadoAuditoriaLog.objects.filter(
            empleado=p_a1,
            accion='DESVINCULACION_CUADRILLA_AUTOMATICA'
        ).first()
        self.assertIsNotNone(log_aux)
        self.assertEqual(log_aux.datos_anteriores['movil'], movil_tiran)
        self.assertEqual(log_aux.datos_nuevos['movil'], '1 - SIN ASIGNAR')

    def test_desactivar_tecnico_no_desvincula_si_queda_otro_tecnico_activo_en_cuadrilla(self):
        """
        Si la cuadrilla cuenta con 2 tecnicos activos y uno se retira, el auxiliar
        debe permanecer en la cuadrilla porque aun cuenta con un tecnico responsable.
        """
        import uuid
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral
        from apps.empleados.services.empleado_workflow_service import EmpleadoWorkflowService

        User = get_user_model()
        uid_op = uuid.uuid4().hex[:6]
        user_op = User.objects.create_user(username=f'op2_{uid_op}', email=f'op2_{uid_op}@cinco.com', password='pwd')

        movil_tiran2 = f'TIRAN_{uuid.uuid4().hex[:6]}'

        # Tecnico 1 en TIRAN
        uid_t1 = uuid.uuid4().hex[:6]
        user_t1 = User.objects.create_user(username=f't1b_{uid_t1}', email=f't1b_{uid_t1}@cinco.com', password='pwd')
        p_t1 = EmpleadoPerfil.objects.create(user=user_t1, numero_documento=f'93{uid_t1}', tipo_documento='CC', nombres='JUAN', apellidos='TEC UNO', estado='ACTIVO')
        lab_t1 = EmpleadoLaboral.objects.create(fecha_ingreso=date(2024, 1, 1), empleado=p_t1, cargo='TECNICO', movil=movil_tiran2, area='OPERACIONES', carpeta='OPERACIONES')

        # Tecnico 2 en TIRAN (coequipero activo)
        uid_t2 = uuid.uuid4().hex[:6]
        user_t2 = User.objects.create_user(username=f't2b_{uid_t2}', email=f't2b_{uid_t2}@cinco.com', password='pwd')
        p_t2 = EmpleadoPerfil.objects.create(user=user_t2, numero_documento=f'94{uid_t2}', tipo_documento='CC', nombres='MIGUEL', apellidos='TEC DOS', estado='ACTIVO')
        lab_t2 = EmpleadoLaboral.objects.create(fecha_ingreso=date(2024, 1, 1), empleado=p_t2, cargo='TECNICO', movil=movil_tiran2, area='OPERACIONES', carpeta='OPERACIONES')

        # Auxiliar en TIRAN
        uid_a = uuid.uuid4().hex[:6]
        user_a = User.objects.create_user(username=f'ab_{uid_a}', email=f'ab_{uid_a}@cinco.com', password='pwd')
        p_a = EmpleadoPerfil.objects.create(user=user_a, numero_documento=f'95{uid_a}', tipo_documento='CC', nombres='DANIEL', apellidos='AUX', estado='ACTIVO')
        lab_a = EmpleadoLaboral.objects.create(fecha_ingreso=date(2024, 1, 1), empleado=p_a, cargo='AUXILIAR', movil=movil_tiran2, area='OPERACIONES', carpeta='OPERACIONES')

        # Desactivar Tecnico 1
        perfil_desc = EmpleadoWorkflowService.desactivar_empleado(
            empleado_id=p_t1.id,
            fecha_egreso='2026-10-30',
            motivo='TERMINACION DE CONTRATO',
            user_operator=user_op,
            ip_address='127.0.0.1'
        )

        # Auxiliar NO debe ser desvinculado porque Tecnico 2 sigue activo en TIRAN02
        lab_a.refresh_from_db()
        self.assertEqual(lab_a.movil, movil_tiran2)
        self.assertEqual(len(perfil_desc.auxiliares_desvinculados), 0)


class EmpleadoAutoHerenciaCuadrillaTests(BaseEmpleadoTestCase):
    """
    Pruebas para la Regla Legacy 2.6 (Líneas 3050-3158 de infraestructura_cinco_sas.php):
    - Auto-herencia de datos al asignar un Auxiliar a una cuadrilla activa (Caso C).
    - Sincronización de Auxiliares cuando el Técnico actualiza supervisor/área/carpeta/transporte.
    - Desvinculación de Auxiliares cuando el Técnico cambia de móvil y la cuadrilla queda vacía.
    - Endpoint cuadrilla-info para consulta previa.
    """

    def test_auxiliar_hereda_datos_de_tecnico_al_asignar_movil(self):
        import uuid
        from datetime import date
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral, EmpleadoMovilidad, EmpleadoAuditoriaLog
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoPerfilDetailSerializer

        User = get_user_model()
        uid_base = uuid.uuid4().hex[:6]
        movil_herencia = f'HERENCIA_{uid_base}'

        user_op = User.objects.create_user(username=f'op_{uid_base}', email=f'op_{uid_base}@cinco.com', password='pwd')

        # 1. Crear Supervisor
        user_sup = User.objects.create_user(username=f'sup_{uid_base}', email=f'sup_{uid_base}@cinco.com', password='pwd')
        p_sup = EmpleadoPerfil.objects.create(user=user_sup, numero_documento=f'10{uid_base}', tipo_documento='CC', nombres='CARLOS', apellidos='SUPERVISOR', estado='ACTIVO')
        EmpleadoLaboral.objects.create(fecha_ingreso=date(2023, 1, 1), empleado=p_sup, cargo='SUPERVISOR DE REDES', tipo_labor='SUPERVISOR', area='REDES FTTH', carpeta='FTTH MEDELLIN')

        # 2. Crear Técnico activo en movil_herencia
        user_tec = User.objects.create_user(username=f'tec_{uid_base}', email=f'tec_{uid_base}@cinco.com', password='pwd')
        p_tec = EmpleadoPerfil.objects.create(user=user_tec, numero_documento=f'20{uid_base}', tipo_documento='CC', nombres='ANDRES', apellidos='TECNICO LIDER', estado='ACTIVO')
        EmpleadoLaboral.objects.create(
            fecha_ingreso=date(2024, 1, 1),
            empleado=p_tec,
            cargo='TECNICO DE REDES',
            movil=movil_herencia,
            area='OPERACIONES REDES',
            carpeta='ZONA NORTE',
            supervisor=p_sup
        )
        EmpleadoMovilidad.objects.create(empleado=p_tec, medio_transporte='MOTO', placa_vehiculo='TEC123')

        # 3. Crear Auxiliar con movil '1 - SIN ASIGNAR' y datos diferentes
        user_aux = User.objects.create_user(username=f'aux_{uid_base}', email=f'aux_{uid_base}@cinco.com', password='pwd')
        p_aux = EmpleadoPerfil.objects.create(user=user_aux, numero_documento=f'30{uid_base}', tipo_documento='CC', nombres='FELIPE', apellidos='AUXILIAR REDES', estado='ACTIVO')
        lab_aux = EmpleadoLaboral.objects.create(
            fecha_ingreso=date(2024, 2, 1),
            empleado=p_aux,
            cargo='AUXILIAR DE REDES',
            movil='1 - SIN ASIGNAR',
            area='GESTION HUMANA',
            carpeta='FORMACION',
            supervisor=None
        )

        # 4. Asignar movil_herencia al Auxiliar mediante Serializer (emulando PATCH)
        factory = APIRequestFactory()
        req = factory.patch(f'/empleados/perfiles/{p_aux.id}/', {})
        req.user = user_op
        req.META['REMOTE_ADDR'] = '192.168.1.100'

        serializer = EmpleadoPerfilDetailSerializer(
            instance=p_aux,
            data={
                'laboral': {
                    'cargo': 'AUXILIAR DE REDES',
                    'movil': movil_herencia,
                    'area': 'GESTION HUMANA',  # Usuario envía datos viejos o incompletos
                    'carpeta': 'FORMACION',
                    'fecha_ingreso': '2024-02-01',
                }
            },
            partial=True,
            context={'request': req}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        # 5. Comprobar que el Auxiliar heredó automáticamente supervisor, área, carpeta y medio_transporte
        lab_aux.refresh_from_db()
        self.assertEqual(lab_aux.movil, movil_herencia)
        self.assertEqual(lab_aux.supervisor_id, p_sup.id)
        self.assertEqual(lab_aux.area, 'OPERACIONES REDES')
        self.assertEqual(lab_aux.carpeta, 'ZONA NORTE')

        mov_aux = EmpleadoMovilidad.objects.get(empleado=p_aux)
        self.assertEqual(mov_aux.medio_transporte, 'MOTO')

        # 6. Validar log de auditoría
        log = EmpleadoAuditoriaLog.objects.filter(
            empleado=p_aux,
            accion='HERENCIA_CUADRILLA_AUXILIAR'
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.datos_nuevos['supervisor_id'], p_sup.id)
        self.assertEqual(log.datos_nuevos['area'], 'OPERACIONES REDES')
        self.assertEqual(log.datos_nuevos['carpeta'], 'ZONA NORTE')
        self.assertEqual(log.datos_nuevos['medio_transporte'], 'MOTO')
        self.assertEqual(log.datos_nuevos['tecnico_origen'], p_tec.nombre_completo)

    def test_tecnico_actualiza_supervisor_y_sincroniza_auxiliar(self):
        import uuid
        from datetime import date
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral, EmpleadoAuditoriaLog
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoPerfilDetailSerializer

        User = get_user_model()
        uid = uuid.uuid4().hex[:6]
        movil = f'SYNC_{uid}'

        user_op = User.objects.create_user(username=f'ops_{uid}', email=f'ops_{uid}@cinco.com', password='pwd')

        # Supervisor 1 y Supervisor 2
        p_sup1 = EmpleadoPerfil.objects.create(user=User.objects.create_user(username=f's1_{uid}'), numero_documento=f'11{uid}', nombres='SUP', apellidos='UNO', estado='ACTIVO')
        p_sup2 = EmpleadoPerfil.objects.create(user=User.objects.create_user(username=f's2_{uid}'), numero_documento=f'12{uid}', nombres='SUP', apellidos='DOS', estado='ACTIVO')

        # Técnico y Auxiliar en la misma móvil
        p_tec = EmpleadoPerfil.objects.create(user=User.objects.create_user(username=f'tc_{uid}'), numero_documento=f'21{uid}', nombres='TEC', apellidos='P', estado='ACTIVO')
        EmpleadoLaboral.objects.create(fecha_ingreso=date(2024, 1, 1), empleado=p_tec, cargo='TECNICO', movil=movil, area='REDES', carpeta='NORTE', supervisor=p_sup1)

        p_aux = EmpleadoPerfil.objects.create(user=User.objects.create_user(username=f'ax_{uid}'), numero_documento=f'31{uid}', nombres='AUX', apellidos='P', estado='ACTIVO')
        lab_aux = EmpleadoLaboral.objects.create(fecha_ingreso=date(2024, 1, 1), empleado=p_aux, cargo='AUXILIAR', movil=movil, area='REDES', carpeta='NORTE', supervisor=p_sup1)

        # Actualizar supervisor del técnico a Supervisor 2 y área a 'REDES SUR'
        factory = APIRequestFactory()
        req = factory.patch(f'/empleados/perfiles/{p_tec.id}/', {})
        req.user = user_op
        req.META['REMOTE_ADDR'] = '127.0.0.1'

        serializer = EmpleadoPerfilDetailSerializer(
            instance=p_tec,
            data={
                'laboral': {
                    'cargo': 'TECNICO',
                    'movil': movil,
                    'area': 'REDES SUR',
                    'carpeta': 'ZONA SUR',
                    'supervisor': p_sup2.id,
                    'fecha_ingreso': '2024-01-01',
                }
            },
            partial=True,
            context={'request': req}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        # El auxiliar debe sincronizarse automáticamente
        lab_aux.refresh_from_db()
        self.assertEqual(lab_aux.supervisor_id, p_sup2.id)
        self.assertEqual(lab_aux.area, 'REDES SUR')
        self.assertEqual(lab_aux.carpeta, 'ZONA SUR')

        log = EmpleadoAuditoriaLog.objects.filter(empleado=p_aux, accion='SINCRONIZACION_CUADRILLA').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.datos_nuevos['supervisor_id'], p_sup2.id)
        self.assertEqual(log.datos_nuevos['area'], 'REDES SUR')

    def test_tecnico_cambia_de_movil_y_desvincula_auxiliar_huerfano(self):
        import uuid
        from datetime import date
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral, EmpleadoAuditoriaLog
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoPerfilDetailSerializer

        User = get_user_model()
        uid = uuid.uuid4().hex[:6]
        movil_ant = f'OLD_{uid}'
        movil_nueva = f'NEW_{uid}'

        user_op = User.objects.create_user(username=f'opm_{uid}', email=f'opm_{uid}@cinco.com', password='pwd')

        p_tec = EmpleadoPerfil.objects.create(user=User.objects.create_user(username=f'tcm_{uid}'), numero_documento=f'41{uid}', nombres='TEC', apellidos='MOV', estado='ACTIVO')
        EmpleadoLaboral.objects.create(fecha_ingreso=date(2024, 1, 1), empleado=p_tec, cargo='TECNICO', movil=movil_ant, area='REDES', carpeta='NORTE')

        p_aux = EmpleadoPerfil.objects.create(user=User.objects.create_user(username=f'axm_{uid}'), numero_documento=f'51{uid}', nombres='AUX', apellidos='MOV', estado='ACTIVO')
        lab_aux = EmpleadoLaboral.objects.create(fecha_ingreso=date(2024, 1, 1), empleado=p_aux, cargo='AUXILIAR', movil=movil_ant, area='REDES', carpeta='NORTE')

        # Técnico cambia a movil_nueva
        factory = APIRequestFactory()
        req = factory.patch(f'/empleados/perfiles/{p_tec.id}/', {})
        req.user = user_op
        req.META['REMOTE_ADDR'] = '127.0.0.1'

        serializer = EmpleadoPerfilDetailSerializer(
            instance=p_tec,
            data={
                'laboral': {
                    'cargo': 'TECNICO',
                    'movil': movil_nueva,
                    'area': 'REDES',
                    'carpeta': 'NORTE',
                    'fecha_ingreso': '2024-01-01',
                }
            },
            partial=True,
            context={'request': req}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        # Auxiliar en movil_ant queda sin técnico -> debe pasar a '1 - SIN ASIGNAR'
        lab_aux.refresh_from_db()
        self.assertEqual(lab_aux.movil, '1 - SIN ASIGNAR')

        log = EmpleadoAuditoriaLog.objects.filter(empleado=p_aux, accion='DESVINCULACION_CUADRILLA').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.datos_anteriores['movil'], movil_ant)
        self.assertEqual(log.datos_nuevos['movil'], '1 - SIN ASIGNAR')

    def test_cuadrilla_info_endpoint(self):
        import uuid
        from datetime import date
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory, force_authenticate
        from apps.empleados.views.empleado_perfil_view import EmpleadoPerfilViewSet
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral, EmpleadoMovilidad

        User = get_user_model()
        uid = uuid.uuid4().hex[:6]
        movil = f'INFO_{uid}'

        user = User.objects.create_user(username=f'uinfo_{uid}', password='pwd')
        p_sup = EmpleadoPerfil.objects.create(user=User.objects.create_user(username=f'sinfo_{uid}'), numero_documento=f'61{uid}', nombres='MARIO', apellidos='SUPERVISOR', estado='ACTIVO')
        p_tec = EmpleadoPerfil.objects.create(user=User.objects.create_user(username=f'tinfo_{uid}'), numero_documento=f'71{uid}', nombres='PEDRO', apellidos='TECNICO', estado='ACTIVO')

        EmpleadoLaboral.objects.create(fecha_ingreso=date(2024, 1, 1), empleado=p_tec, cargo='TECNICO FIBRA', movil=movil, area='FIBRA OPTICA', carpeta='CARPETA ORIENTE', supervisor=p_sup)
        EmpleadoMovilidad.objects.create(empleado=p_tec, medio_transporte='CAMIONETA')

        factory = APIRequestFactory()
        view = EmpleadoPerfilViewSet.as_view({'get': 'cuadrilla_info'})

        # 1. Consulta móvil existente
        req = factory.get(f'/empleados/perfiles/cuadrilla-info/?movil={movil}')
        force_authenticate(req, user=user)
        res = view(req)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['existe_tecnico'])
        self.assertEqual(res.data['tecnico']['nombre_completo'], p_tec.nombre_completo)
        self.assertEqual(res.data['tecnico']['area'], 'FIBRA OPTICA')
        self.assertEqual(res.data['tecnico']['carpeta'], 'CARPETA ORIENTE')
        self.assertEqual(res.data['tecnico']['supervisor_id'], p_sup.id)
        self.assertEqual(res.data['tecnico']['medio_transporte'], 'CAMIONETA')

        # 2. Consulta móvil '1 - SIN ASIGNAR'
        req_sin = factory.get('/empleados/perfiles/cuadrilla-info/?movil=1 - SIN ASIGNAR')
        force_authenticate(req_sin, user=user)
        res_sin = view(req_sin)
        self.assertEqual(res_sin.status_code, 200)
        self.assertFalse(res_sin.data['existe_tecnico'])


class EmpleadoReactivacionRecuperarMovilTests(BaseEmpleadoTestCase):
    """
    Pruebas para la Regla Legacy 2.7 (Líneas 824-858 de infraestructura_cinco_sas.php):
    - Recuperación del móvil previo desde la bitácora de auditoría al reactivar un colaborador.
    - Soporte para override de móvil si se especifica uno explícito.
    - Endpoint movil-previa.
    - Fallback a '1 - SIN ASIGNAR' si no hay registro histórico.
    """

    def test_reactivar_recupera_movil_previa_desactivacion(self):
        import uuid
        from datetime import date
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory, force_authenticate
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral, EmpleadoAuditoriaLog
        from apps.empleados.services.empleado_workflow_service import EmpleadoWorkflowService
        from apps.empleados.views.empleado_perfil_view import EmpleadoPerfilViewSet

        User = get_user_model()
        uid = uuid.uuid4().hex[:6]
        movil_original = f'TIRAN_REC_{uid}'

        user_op = User.objects.create_user(username=f'op_rec_{uid}', password='pwd')
        user_emp = User.objects.create_user(username=f'emp_rec_{uid}', password='pwd')

        # 1. Crear empleado activo con cuadrilla asignada
        p = EmpleadoPerfil.objects.create(user=user_emp, numero_documento=f'88{uid}', tipo_documento='CC', nombres='JUAN', apellidos='PEREZ', estado='ACTIVO')
        lab = EmpleadoLaboral.objects.create(fecha_ingreso=date(2024, 1, 1), empleado=p, cargo='TECNICO', movil=movil_original, area='REDES', carpeta='NORTE')

        # 2. Desactivar empleado
        EmpleadoWorkflowService.desactivar_empleado(
            empleado_id=p.id,
            fecha_egreso='2026-10-30',
            motivo='TERMINACION VOLUNTARIA',
            user_operator=user_op,
            ip_address='127.0.0.1'
        )

        p.refresh_from_db()
        lab.refresh_from_db()
        self.assertEqual(p.estado, 'INACTIVO')
        self.assertEqual(lab.movil, 'Z - FUERA DE OPERACION')

        # 3. Consultar endpoint movil-previa
        factory = APIRequestFactory()
        view_previa = EmpleadoPerfilViewSet.as_view({'get': 'movil_previa'})
        req_prev = factory.get(f'/empleados/perfiles/{p.id}/movil-previa/')
        force_authenticate(req_prev, user=user_op)
        res_prev = view_previa(req_prev, pk=p.id)
        self.assertEqual(res_prev.status_code, 200)
        self.assertEqual(res_prev.data['movil_previa'], movil_original)

        # 4. Reactivar sin enviar movil_inicial (debe recuperar movil_original)
        view_react = EmpleadoPerfilViewSet.as_view({'post': 'reactivar'})
        req_react = factory.post(f'/empleados/perfiles/{p.id}/reactivar/', {'observaciones': 'Reingreso autorizado'})
        force_authenticate(req_react, user=user_op)
        res_react = view_react(req_react, pk=p.id)

        self.assertEqual(res_react.status_code, 200)
        self.assertEqual(res_react.data['estado'], 'ACTIVO')
        self.assertEqual(res_react.data['movil'], movil_original)

        p.refresh_from_db()
        lab.refresh_from_db()
        self.assertEqual(p.estado, 'ACTIVO')
        self.assertTrue(p.user.is_active)
        self.assertIsNone(lab.fecha_egreso)
        self.assertEqual(lab.movil, movil_original)

        # 5. Validar traza de auditoría de reactivación
        log_react = EmpleadoAuditoriaLog.objects.filter(empleado=p, accion='REACTIVACION').first()
        self.assertIsNotNone(log_react)
        self.assertEqual(log_react.datos_nuevos['movil'], movil_original)
        self.assertEqual(log_react.datos_nuevos['observaciones'], 'Reingreso autorizado')

    def test_reactivar_con_override_de_movil(self):
        import uuid
        from datetime import date
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral
        from apps.empleados.services.empleado_workflow_service import EmpleadoWorkflowService

        User = get_user_model()
        uid = uuid.uuid4().hex[:6]
        user_op = User.objects.create_user(username=f'op_ov_{uid}', password='pwd')
        user_emp = User.objects.create_user(username=f'emp_ov_{uid}', password='pwd')

        p = EmpleadoPerfil.objects.create(user=user_emp, numero_documento=f'89{uid}', tipo_documento='CC', nombres='ANDREA', apellidos='GARCIA', estado='ACTIVO')
        EmpleadoLaboral.objects.create(fecha_ingreso=date(2024, 1, 1), empleado=p, cargo='AUXILIAR', movil=f'OLD_MOV_{uid}', area='REDES', carpeta='NORTE')

        EmpleadoWorkflowService.desactivar_empleado(
            empleado_id=p.id,
            fecha_egreso='2026-10-30',
            motivo='RETIRO',
            user_operator=user_op
        )

        movil_custom = f'CUSTOM_{uid}'
        EmpleadoWorkflowService.reactivar_empleado(
            empleado_id=p.id,
            movil_inicial=movil_custom,
            user_operator=user_op
        )

        p.refresh_from_db()
        self.assertEqual(p.laboral.movil, movil_custom)

    def test_reactivar_sin_historial_fallback_sin_asignar(self):
        import uuid
        from datetime import date
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral
        from apps.empleados.services.empleado_workflow_service import EmpleadoWorkflowService

        User = get_user_model()
        uid = uuid.uuid4().hex[:6]
        user_op = User.objects.create_user(username=f'op_fb_{uid}', password='pwd')
        user_emp = User.objects.create_user(username=f'emp_fb_{uid}', password='pwd')

        # Empleado creado directamente inactivo sin logs de desactivación
        p = EmpleadoPerfil.objects.create(user=user_emp, numero_documento=f'90{uid}', tipo_documento='CC', nombres='LUCAS', apellidos='MORA', estado='INACTIVO')
        EmpleadoLaboral.objects.create(fecha_ingreso=date(2024, 1, 1), empleado=p, cargo='AUXILIAR', movil='Z - FUERA DE OPERACION', area='REDES', carpeta='NORTE')

        EmpleadoWorkflowService.reactivar_empleado(
            empleado_id=p.id,
            user_operator=user_op
        )

        p.refresh_from_db()
        self.assertEqual(p.laboral.movil, '1 - SIN ASIGNAR')


class EmpleadoAprendicesSenaTests(BaseEmpleadoTestCase):
    """
    Pruebas para la Regla Legacy 2.8 (Líneas 7600-7649 de infraestructura_cinco_sas.php):
    - Autocálculo de 6 meses para etapas lectivas y productivas en aprendices SENA.
    - Manejo de fin de mes y años bisiestos/meses de 28-30 días.
    - Autocompletado en creación y actualización laboral.
    """

    def test_calcular_seis_meses_despues_algoritmo(self):
        from datetime import date
        from apps.empleados.services.empleado_workflow_service import EmpleadoWorkflowService

        # 1. Fecha estándar: 15 de enero a 15 de julio
        f1 = EmpleadoWorkflowService.calcular_seis_meses_despues('2024-01-15')
        self.assertEqual(f1, date(2024, 7, 15))

        # 2. Ajuste a fin de mes: 31 de agosto + 6 meses -> 28 de febrero (año no bisiesto)
        f2 = EmpleadoWorkflowService.calcular_seis_meses_despues('2024-08-31')
        self.assertEqual(f2, date(2025, 2, 28))

        # 3. Ajuste a fin de mes: 31 de marzo + 6 meses -> 30 de septiembre
        f3 = EmpleadoWorkflowService.calcular_seis_meses_despues('2024-03-31')
        self.assertEqual(f3, date(2024, 9, 30))

        # 4. Fin de mes en año bisiesto: 31 de agosto de 2023 + 6 meses -> 29 de febrero de 2024
        f4 = EmpleadoWorkflowService.calcular_seis_meses_despues('2023-08-31')
        self.assertEqual(f4, date(2024, 2, 29))

    def test_crear_empleado_autocalcula_etapas_sena(self):
        import uuid
        from datetime import date
        from django.contrib.auth import get_user_model
        from apps.empleados.services.empleado_workflow_service import EmpleadoWorkflowService

        User = get_user_model()
        uid = uuid.uuid4().hex[:6]
        user_op = User.objects.create_user(username=f'opsena_{uid}', password='pwd')

        data = {
            'numero_documento': f'71{uid}',
            'nombres': 'CAROLINA',
            'apellidos': 'GOMEZ SENA',
            'laboral': {
                'cargo': 'APRENDIZ SENA ETAPA LECTIVA',
                'fecha_ingreso': '2024-02-01',
                'practica_lectiva_inicio': '2024-02-01',
                'practica_productiva_inicio': '2024-08-01',
            }
        }

        perfil = EmpleadoWorkflowService.crear_empleado(
            data=data,
            user_creator=user_op,
            ip_address='127.0.0.1'
        )

        lab = perfil.laboral
        lab.refresh_from_db()
        self.assertEqual(lab.practica_lectiva_inicio, date(2024, 2, 1))
        self.assertEqual(lab.practica_lectiva_fin, date(2024, 8, 1))
        self.assertEqual(lab.practica_productiva_inicio, date(2024, 8, 1))
        self.assertEqual(lab.practica_productiva_fin, date(2025, 2, 1))

    def test_actualizar_laboral_autocalcula_etapa_productiva_serializer(self):
        import uuid
        from datetime import date
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoPerfilDetailSerializer

        User = get_user_model()
        uid = uuid.uuid4().hex[:6]
        user_op = User.objects.create_user(username=f'upsena_{uid}', password='pwd')

        p = EmpleadoPerfil.objects.create(
            user=User.objects.create_user(username=f'empsena_{uid}'),
            numero_documento=f'72{uid}',
            nombres='ESTEBAN',
            apellidos='APRENDIZ',
            estado='ACTIVO'
        )
        lab = EmpleadoLaboral.objects.create(
            fecha_ingreso=date(2024, 1, 1),
            empleado=p,
            cargo='APRENDIZ SENA'
        )

        factory = APIRequestFactory()
        req = factory.patch(f'/empleados/perfiles/{p.id}/', {})
        req.user = user_op
        req.META['REMOTE_ADDR'] = '127.0.0.1'

        serializer = EmpleadoPerfilDetailSerializer(
            instance=p,
            data={
                'laboral': {
                    'cargo': 'APRENDIZ SENA',
                    'fecha_ingreso': '2024-01-01',
                    'practica_productiva_inicio': '2024-03-31',
                }
            },
            partial=True,
            context={'request': req}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        lab.refresh_from_db()
        self.assertEqual(lab.practica_productiva_inicio, date(2024, 3, 31))
        self.assertEqual(lab.practica_productiva_fin, date(2024, 9, 30))


class EmpleadoPeriodoPruebaSemaforoTests(BaseEmpleadoTestCase):
    """
    Pruebas para la Regla Legacy 2.9 (Líneas 8426-8433, 8454 de infraestructura_cinco_sas.php
    y cont_consulta_infra.php: DATEDIFF(DATE_ADD(fecha_ingreso, INTERVAL 2 MONTH), CURDATE())):
    - Cálculo de 2 meses exactos calendario para el período de prueba.
    - Días restantes y flag en_periodo_prueba.
    - Semaforización tricolor: Verde (>30d), Amarillo (16-30d), Rojo (<=15d) y Superado (<0d).
    - Serialización en EmpleadoPerfilListSerializer y EmpleadoLaboralSerializer.
    """

    def setUp(self):
        import uuid
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral
        User = get_user_model()
        uid = uuid.uuid4().hex[:6]
        self.user = User.objects.create_user(username=f'usr_pp_{uid}', password='pwd')
        self.perfil = EmpleadoPerfil.objects.create(
            user=self.user,
            numero_documento=f'99{uid}',
            nombres='CARLOS',
            apellidos='PRUEBA',
            estado='ACTIVO'
        )

    def test_calculo_periodo_prueba_verde_mas_de_30_dias(self):
        import calendar
        from datetime import date, timedelta
        from django.utils import timezone
        from apps.empleados.models import EmpleadoLaboral

        # Ingresó hace 10 días -> le quedan aprox 50 días (Verde > 30)
        hoy = timezone.now().date()
        fecha_ing = hoy - timedelta(days=10)

        lab = EmpleadoLaboral.objects.create(
            empleado=self.perfil,
            cargo='TECNICO',
            fecha_ingreso=fecha_ing
        )

        self.assertTrue(lab.en_periodo_prueba)
        self.assertTrue(self.perfil.en_periodo_prueba)
        self.assertGreater(lab.dias_para_periodo_prueba, 30)
        self.assertEqual(lab.dias_para_periodo_prueba, self.perfil.dias_para_periodo_prueba)

    def test_calculo_periodo_prueba_amarillo_16_a_30_dias(self):
        from datetime import timedelta
        from django.utils import timezone
        from apps.empleados.models import EmpleadoLaboral

        hoy = timezone.now().date()
        # Si le quedan 20 días para cumplir 2 meses (aprox 60 días totales): ingresó hace 40 días
        # Ajustamos dinámicamente para que caiga exactamente entre 16 y 30 días
        fecha_ing = hoy - timedelta(days=38)

        lab = EmpleadoLaboral.objects.create(
            empleado=self.perfil,
            cargo='TECNICO',
            fecha_ingreso=fecha_ing
        )

        self.assertTrue(lab.en_periodo_prueba)
        self.assertGreaterEqual(lab.dias_para_periodo_prueba, 16)
        self.assertLessEqual(lab.dias_para_periodo_prueba, 30)

    def test_calculo_periodo_prueba_rojo_critico_menor_igual_15_dias(self):
        from datetime import timedelta
        from django.utils import timezone
        from apps.empleados.models import EmpleadoLaboral

        hoy = timezone.now().date()
        # Le quedan 5 días para cumplir 2 meses: ingresó hace aprox 55 días
        fecha_ing = hoy - timedelta(days=55)

        lab = EmpleadoLaboral.objects.create(
            empleado=self.perfil,
            cargo='TECNICO',
            fecha_ingreso=fecha_ing
        )

        self.assertTrue(lab.en_periodo_prueba)
        self.assertGreaterEqual(lab.dias_para_periodo_prueba, 0)
        self.assertLessEqual(lab.dias_para_periodo_prueba, 15)

    def test_periodo_prueba_superado(self):
        from datetime import timedelta
        from django.utils import timezone
        from apps.empleados.models import EmpleadoLaboral

        hoy = timezone.now().date()
        # Ingresó hace 120 días -> superado hace casi 2 meses
        fecha_ing = hoy - timedelta(days=120)

        lab = EmpleadoLaboral.objects.create(
            empleado=self.perfil,
            cargo='TECNICO',
            fecha_ingreso=fecha_ing
        )

        self.assertFalse(lab.en_periodo_prueba)
        self.assertFalse(self.perfil.en_periodo_prueba)
        self.assertLess(lab.dias_para_periodo_prueba, 0)

    def test_serializer_listado_incluye_periodo_prueba(self):
        from datetime import timedelta
        from django.utils import timezone
        from apps.empleados.models import EmpleadoLaboral
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoPerfilListSerializer

        hoy = timezone.now().date()
        EmpleadoLaboral.objects.create(
            empleado=self.perfil,
            cargo='TECNICO',
            fecha_ingreso=hoy - timedelta(days=15)
        )

        serializer = EmpleadoPerfilListSerializer(instance=self.perfil)
        data = serializer.data

        self.assertIn('dias_para_periodo_prueba', data)
        self.assertIn('en_periodo_prueba', data)
        self.assertTrue(data['en_periodo_prueba'])
        self.assertGreater(data['dias_para_periodo_prueba'], 30)

    def test_endpoint_filtrar_periodo_prueba(self):
        from datetime import timedelta
        from django.utils import timezone
        from rest_framework.test import APIClient
        from apps.empleados.models import EmpleadoLaboral

        hoy = timezone.now().date()
        EmpleadoLaboral.objects.create(
            empleado=self.perfil,
            cargo='TECNICO',
            fecha_ingreso=hoy - timedelta(days=20)
        )

        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.get('/empleados/perfiles/?periodo_prueba=true')
        self.assertEqual(response.status_code, 200)
        data = response.data if isinstance(response.data, list) else response.data.get('results', [])
        ids = [item['id'] for item in data]
        self.assertIn(self.perfil.id, ids)


class EmpleadoSubirFotoTests(BaseEmpleadoTestCase):
    """
    Pruebas para la carga de fotografía de perfil del colaborador (Regla Legacy: save_foto).
    """

    def setUp(self):
        import uuid
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil
        User = get_user_model()
        uid = uuid.uuid4().hex[:6]
        self.user = User.objects.create_user(username=f'foto_usr_{uid}', password='pwd')
        self.perfil = EmpleadoPerfil.objects.create(
            user=self.user,
            numero_documento=f'88{uid}',
            nombres='FOTO',
            apellidos='EMPLEADO',
            estado='ACTIVO',
            foto_url='photos/Default.png'
        )

    def test_subir_foto_exitoso(self):
        import os
        from django.conf import settings
        from django.core.files.uploadedfile import SimpleUploadedFile
        from rest_framework.test import APIClient
        from apps.empleados.models import EmpleadoAuditoriaLog

        client = APIClient()
        client.force_authenticate(user=self.user)

        fake_image = SimpleUploadedFile(
            name="test_avatar.jpg",
            content=b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00",
            content_type="image/jpeg"
        )

        response = client.post(
            f"/empleados/perfiles/{self.perfil.id}/subir-foto/",
            {'foto': fake_image},
            format='multipart'
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get('success'))
        self.assertTrue(response.data.get('foto_url').startswith('/media/infraestructura/fotos_empleados/'))

        self.perfil.refresh_from_db()
        self.assertEqual(self.perfil.foto_url, response.data['foto_url'])

        # Verificar auditoría
        audit = EmpleadoAuditoriaLog.objects.filter(
            empleado=self.perfil,
            accion='ACTUALIZACION',
            tabla_afectada='empleados_perfiles'
        ).last()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.datos_anteriores.get('foto_url'), 'photos/Default.png')
        self.assertEqual(audit.datos_nuevos.get('foto_url'), response.data['foto_url'])

        # Limpiar archivo físico creado
        saved_file_rel = response.data['foto_url'].lstrip('/')
        if saved_file_rel.startswith('media/'):
            saved_file_rel = saved_file_rel[6:]
        saved_file_abs = os.path.join(settings.MEDIA_ROOT, saved_file_rel)
        if os.path.exists(saved_file_abs):
            try:
                os.remove(saved_file_abs)
            except Exception:
                pass

    def test_subir_foto_formato_invalido(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(user=self.user)

        fake_txt = SimpleUploadedFile(
            name="malicious.txt",
            content=b"not an image",
            content_type="text/plain"
        )

        response = client.post(
            f"/empleados/perfiles/{self.perfil.id}/subir-foto/",
            {'foto': fake_txt},
            format='multipart'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.data)


class EmpleadoComprobantesDotacionTests(BaseEmpleadoTestCase):
    """
    Pruebas unitarias para la carga, listado y eliminación de actas físicas y comprobantes
    firmados de entrega de dotación (Regla Legacy: guardar_dotacion / name-file_entrega_dotacion).
    """

    def setUp(self):
        import uuid
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil
        User = get_user_model()
        uid = uuid.uuid4().hex[:6]
        self.user = User.objects.create_user(username=f'dot_usr_{uid}', password='pwd')
        self.perfil = EmpleadoPerfil.objects.create(
            user=self.user,
            numero_documento=f'99{uid}',
            nombres='DOTACION',
            apellidos='TEST',
            estado='ACTIVO'
        )

    def test_subir_comprobante_dotacion_pdf_exitoso(self):
        import os
        from django.conf import settings
        from django.core.files.uploadedfile import SimpleUploadedFile
        from rest_framework.test import APIClient
        from apps.empleados.models import EmpleadoDotacionComprobante, EmpleadoAuditoriaLog

        client = APIClient()
        client.force_authenticate(user=self.user)

        fake_pdf = SimpleUploadedFile(
            name="acta_entrega.pdf",
            content=b"%PDF-1.4 test entrega dotacion signed act content",
            content_type="application/pdf"
        )

        response = client.post(
            f"/empleados/perfiles/{self.perfil.id}/comprobantes-dotacion/",
            {
                'archivo': fake_pdf,
                'fecha_entrega': '2026-11-03',
                'observaciones': 'Entrega dotación 2 camisas y 1 par de botas'
            },
            format='multipart'
        )

        self.assertEqual(response.status_code, 201)
        self.assertIn('id', response.data)
        self.assertEqual(response.data['fecha_entrega'], '2026-11-03')
        self.assertEqual(response.data['observaciones'], 'Entrega dotación 2 camisas y 1 par de botas')
        self.assertTrue(response.data['archivo_url'].startswith('/media/infraestructura/dotacion/'))
        self.assertTrue(response.data['archivo_url'].endswith('.pdf'))

        # Validar en base de datos
        comp = EmpleadoDotacionComprobante.objects.filter(id=response.data['id']).first()
        self.assertIsNotNone(comp)
        self.assertEqual(comp.empleado, self.perfil)
        self.assertEqual(str(comp.fecha_entrega), '2026-11-03')

        # Validar auditoría
        audit = EmpleadoAuditoriaLog.objects.filter(
            empleado=self.perfil,
            accion='CARGA_COMPROBANTE_DOTACION',
            tabla_afectada='empleados_dotacion_comprobantes'
        ).last()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.datos_nuevos.get('id'), comp.id)

        # Limpiar archivo físico
        saved_file_rel = response.data['archivo_url'].lstrip('/')
        if saved_file_rel.startswith('media/'):
            saved_file_rel = saved_file_rel[6:]
        saved_file_abs = os.path.join(settings.MEDIA_ROOT, saved_file_rel)
        if os.path.exists(saved_file_abs):
            try:
                os.remove(saved_file_abs)
            except Exception:
                pass

    def test_subir_comprobante_dotacion_compatibilidad_legacy(self):
        import os
        from django.conf import settings
        from django.core.files.uploadedfile import SimpleUploadedFile
        from rest_framework.test import APIClient
        from apps.empleados.models import EmpleadoDotacionComprobante

        client = APIClient()
        client.force_authenticate(user=self.user)

        fake_img = SimpleUploadedFile(
            name="comprobante_scan.png",
            content=b"FAKE-PNG-IMAGE-BINARY-DATA-TEST",
            content_type="image/png"
        )

        # Utilizar nombres de campo de la interfaz legacy PHP
        response = client.post(
            f"/empleados/perfiles/{self.perfil.id}/comprobantes-dotacion/",
            {
                'name-file_entrega_dotacion': fake_img,
                'fecha_entrega_dotacion': '2026-10-15',
                'observaciones': 'Entrega dotación SST'
            },
            format='multipart'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['fecha_entrega'], '2026-10-15')
        self.assertTrue(response.data['archivo_url'].endswith('.png'))

        # Limpiar archivo físico
        saved_file_rel = response.data['archivo_url'].lstrip('/')
        if saved_file_rel.startswith('media/'):
            saved_file_rel = saved_file_rel[6:]
        saved_file_abs = os.path.join(settings.MEDIA_ROOT, saved_file_rel)
        if os.path.exists(saved_file_abs):
            try:
                os.remove(saved_file_abs)
            except Exception:
                pass

    def test_subir_comprobante_sin_archivo_falla(self):
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.post(
            f"/empleados/perfiles/{self.perfil.id}/comprobantes-dotacion/",
            {'fecha_entrega': '2026-11-03'},
            format='multipart'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.data)

    def test_subir_comprobante_formato_invalido(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(user=self.user)

        fake_doc = SimpleUploadedFile(
            name="script.sh",
            content=b"#!/bin/bash echo hello",
            content_type="text/x-sh"
        )

        response = client.post(
            f"/empleados/perfiles/{self.perfil.id}/comprobantes-dotacion/",
            {'archivo': fake_doc},
            format='multipart'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.data)

    def test_listar_comprobantes_dotacion(self):
        from datetime import date
        from rest_framework.test import APIClient
        from apps.empleados.models import EmpleadoDotacionComprobante

        EmpleadoDotacionComprobante.objects.create(
            empleado=self.perfil,
            fecha_entrega=date(2026, 5, 10),
            observaciones='Entrega mayo',
            archivo_url='/media/infraestructura/dotacion/dummy1.pdf',
            subido_por=self.user
        )
        EmpleadoDotacionComprobante.objects.create(
            empleado=self.perfil,
            fecha_entrega=date(2026, 9, 20),
            observaciones='Entrega septiembre',
            archivo_url='/media/infraestructura/dotacion/dummy2.pdf',
            subido_por=self.user
        )

        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.get(f"/empleados/perfiles/{self.perfil.id}/comprobantes-dotacion/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        # Orden descendente por fecha_entrega
        self.assertEqual(response.data[0]['fecha_entrega'], '2026-09-20')
        self.assertEqual(response.data[1]['fecha_entrega'], '2026-05-10')

    def test_eliminar_comprobante_dotacion_exitoso(self):
        import os
        from datetime import date
        from django.conf import settings
        from rest_framework.test import APIClient
        from apps.empleados.models import EmpleadoDotacionComprobante, EmpleadoAuditoriaLog

        # Crear archivo temporal
        sub_dir = os.path.join(settings.MEDIA_ROOT, 'infraestructura', 'dotacion')
        os.makedirs(sub_dir, exist_ok=True)
        dummy_file = os.path.join(sub_dir, 'test_delete_doc.pdf')
        with open(dummy_file, 'w') as f:
            f.write('dummy content')

        comp = EmpleadoDotacionComprobante.objects.create(
            empleado=self.perfil,
            fecha_entrega=date(2026, 11, 1),
            observaciones='Por eliminar',
            archivo_url='/media/infraestructura/dotacion/test_delete_doc.pdf',
            subido_por=self.user
        )

        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.delete(f"/empleados/perfiles/{self.perfil.id}/comprobantes-dotacion/{comp.id}/")
        self.assertEqual(response.status_code, 200)

        # Verificar que el registro no existe
        self.assertFalse(EmpleadoDotacionComprobante.objects.filter(id=comp.id).exists())

        # Verificar que el archivo físico fue eliminado
        self.assertFalse(os.path.exists(dummy_file))

        # Verificar auditoría
        audit = EmpleadoAuditoriaLog.objects.filter(
            empleado=self.perfil,
            accion='ELIMINACION_COMPROBANTE_DOTACION',
            tabla_afectada='empleados_dotacion_comprobantes'
        ).last()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.datos_anteriores.get('id'), comp.id)


    def test_importar_y_listar_ssff(self):
        from io import BytesIO
        from rest_framework.test import APIClient
        from apps.empleados.models import EmpleadoSSFF

        EmpleadoSSFF.objects.all().delete()

        old_ssff = EmpleadoSSFF.objects.create(
            cedula='999999999',
            estado='ACTIVO',
            datos={'nombres': 'ANTIGUO', 'apellidos': 'USUARIO'}
        )

        client = APIClient()
        client.force_authenticate(user=self.user)

        from datetime import date
        from apps.empleados.models import EmpleadoLaboral

        doc_perfil = '77112233'
        self.perfil.numero_documento = doc_perfil
        self.perfil.save()
        lab, _ = EmpleadoLaboral.objects.get_or_create(
            empleado=self.perfil,
            defaults={
                'cargo': 'TECNICO',
                'area': 'OPERACIONES',
                'carpeta': 'OPERACIONES',
                'fecha_ingreso': date(2024, 1, 1),
            }
        )
        lab.codigo_sap = None
        lab.save()

        csv_content = (
            "Cédula;Nombres;Apellidos;Status;UserID;Hire Date\n"
            f"{doc_perfil};JUAN PABLO;PEREZ;Active;884422;01/02/2024\n"
            "1020304050;CARLOS;GOMEZ;Active;112233;15/03/2024\n"
            "1.01E+09;ERROR;EXCEL;Active;998877;01/01/2024\n"
        ).encode('utf-8')

        file_obj = BytesIO(csv_content)
        file_obj.name = 'reporte_ssff.csv'

        response = client.post(
            "/empleados/conciliacion/ssff/importar/",
            {'file': file_obj},
            format='multipart'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['cnt_insertados'], 2)
        self.assertEqual(data['cnt_desactivados'], 1)
        self.assertEqual(data['cnt_sap_actualizados'], 1)
        self.assertEqual(len(data['cedulas_con_error']), 1)
        self.assertEqual(data['cedulas_con_error'][0]['cedula'], '1.01E+09')

        old_ssff.refresh_from_db()
        self.assertEqual(old_ssff.estado, 'DELETE')

        self.perfil.laboral.refresh_from_db()
        self.assertEqual(self.perfil.laboral.codigo_sap, '884422')

        list_resp = client.get("/empleados/conciliacion/ssff/?estado=ACTIVO")
        self.assertEqual(list_resp.status_code, 200)
        results = list_resp.json().get('results', list_resp.json())
        self.assertEqual(len(results), 2)
        item_perfil = next(r for r in results if r['cedula'] == doc_perfil)
        self.assertTrue(item_perfil['vinculado_en_personal'])
        self.assertEqual(item_perfil['userid'], '884422')
        self.assertEqual(item_perfil['empleado_id'], self.perfil.id)
        self.assertIsNotNone(item_perfil['updated_at'])

        obj_ssff = EmpleadoSSFF.objects.get(cedula=doc_perfil)
        self.assertEqual(obj_ssff.empleado, self.perfil)
        self.assertEqual(obj_ssff.userid, '884422')
        self.assertIsNotNone(obj_ssff.updated_at)

    def test_importar_y_listar_siigo(self):
        from io import BytesIO
        from rest_framework.test import APIClient
        from apps.empleados.models import EmpleadoSIIGO

        EmpleadoSIIGO.objects.all().delete()

        old_siigo = EmpleadoSIIGO.objects.create(
            cedula='888888888',
            estado='ACTIVO',
            datos={'nombre_empleado': 'ANTERIOR SIIGO'}
        )

        self.perfil.numero_documento = '1020304050'
        self.perfil.save()

        client = APIClient()
        client.force_authenticate(user=self.user)

        csv_content = (
            "NIT;Nombre;Ciudad;Nombre;CC;Sueldo;Pension\n"
            "1020304050;CARLOS GOMEZ;05001;MEDELLIN;OPERACIONES;2.500.000,00;PROTECCION\n"
            "1030405060;MARIA LOPEZ;05001;MEDELLIN;ADMIN;3.000.000,00;PORVENIR\n"
        ).encode('utf-8')

        file_obj = BytesIO(csv_content)
        file_obj.name = 'reporte_siigo.csv'

        response = client.post(
            "/empleados/conciliacion/siigo/importar/",
            {'file': file_obj},
            format='multipart'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['cnt_insertados'], 2)
        self.assertEqual(data['cnt_desactivados'], 1)

        old_siigo.refresh_from_db()
        self.assertEqual(old_siigo.estado, 'INACTIVO')

        obj_carlos = EmpleadoSIIGO.objects.get(cedula='1020304050')
        self.assertEqual(obj_carlos.estado, 'ACTIVO')
        self.assertEqual(obj_carlos.centro_costo, 'OPERACIONES')
        self.assertEqual(obj_carlos.salario, '2500000.00')

        list_resp = client.get("/empleados/conciliacion/siigo/?estado=ACTIVO")
        self.assertEqual(list_resp.status_code, 200)
        results = list_resp.json().get('results', list_resp.json())
        self.assertEqual(len(results), 2)

        item_carlos = next(r for r in results if r['cedula'] == '1020304050')
        self.assertTrue(item_carlos['vinculado_en_personal'])
        self.assertEqual(item_carlos['empleado_id'], self.perfil.id)
        self.assertIsNotNone(item_carlos['updated_at'])
        self.assertEqual(obj_carlos.empleado, self.perfil)
        self.assertEqual(obj_carlos.nombre_empleado, 'CARLOS GOMEZ')
        self.assertIsNotNone(obj_carlos.updated_at)

    def test_alertas_practicas_sena(self):
        from rest_framework.test import APIClient
        from datetime import timedelta
        from django.utils import timezone
        from apps.empleados.models import EmpleadoLaboral

        hoy = timezone.now().date()
        lab, _ = EmpleadoLaboral.objects.get_or_create(
            empleado=self.perfil,
            defaults={
                'cargo': 'TECNICO',
                'area': 'OPERACIONES',
                'carpeta': 'OPERACIONES',
                'fecha_ingreso': hoy,
            }
        )
        lab.cargo = 'APRENDIZ SENA'
        lab.practica_lectiva_inicio = hoy - timedelta(days=170)
        lab.practica_lectiva_fin = hoy + timedelta(days=10)
        lab.practica_productiva_inicio = hoy + timedelta(days=11)
        lab.practica_productiva_fin = hoy + timedelta(days=191)
        lab.save()

        # 1. Properties
        self.assertEqual(lab.etapa_practica_activa, 'LECTIVA')
        self.assertEqual(lab.dias_para_fin_practica, 10)
        self.assertTrue(lab.en_practicas)
        self.assertEqual(self.perfil.dias_para_fin_practica, 10)
        self.assertEqual(self.perfil.etapa_practica_activa, 'LECTIVA')
        self.assertTrue(self.perfil.en_practicas)

        # 2. List endpoint with filter
        client = APIClient()
        client.force_authenticate(user=self.user)
        resp = client.get("/empleados/perfiles/?solo_practicas=true")
        self.assertEqual(resp.status_code, 200)
        data_resp = resp.json()
        results = data_resp if isinstance(data_resp, list) else data_resp.get('results', [])
        item = next((r for r in results if r['id'] == self.perfil.id), None)
        self.assertIsNotNone(item)
        self.assertEqual(item['dias_para_fin_practica'], 10)
        self.assertEqual(item['etapa_practica_activa'], 'LECTIVA')
        self.assertTrue(item['en_practicas'])
        self.assertEqual(item['practica_lectiva_fin'], (hoy + timedelta(days=10)).isoformat())

        # 3. Estadisticas endpoint
        stats_resp = client.get("/empleados/perfiles/estadisticas/")
        self.assertEqual(stats_resp.status_code, 200)
        stats = stats_resp.json()
        self.assertIn('en_practicas', stats)
        self.assertIn('practicas_criticas', stats)
        self.assertGreaterEqual(stats['en_practicas'], 1)
        self.assertGreaterEqual(stats['practicas_criticas'], 1)


class ScopedEmpleadoQuerySetTests(BaseEmpleadoTestCase):
    """
    Pruebas unitarias para el mixin de alcance de datos ScopedEmpleadoQuerySetMixin (Fase 2).
    Verifica que:
    1. Superusuario ve todos los colaboradores.
    2. Usuario con 'ver_todos_empleados' (GH/SST) ve todos los colaboradores.
    3. Usuario con 'ver_equipo_empleados' (Líder) solo ve colaboradores de su área o supervisados por él.
    4. Líder no ve a colaboradores de otra área.
    5. Colaborador regular solo se ve a sí mismo en la lista.
    6. Usuario sin perfil (admin técnico o bot) no genera 500 y recibe lista vacía.
    """

    def setUp(self):
        super().setUp()
        from django.contrib.auth.models import User, Permission
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral
        from apps.empleados.views.empleado_perfil_view import EmpleadoPerfilViewSet
        from rest_framework.test import APIRequestFactory

        self.factory = APIRequestFactory()
        self.view = EmpleadoPerfilViewSet()

        self.u_admin = User.objects.create(username='test_admin_scope', is_superuser=True)

        self.u_gh = User.objects.create(username='test_gh_scope')
        self.p_gh = EmpleadoPerfil.objects.create(user=self.u_gh, numero_documento='GH_SCOPE_001', nombres='Ana', apellidos='GH')
        EmpleadoLaboral.objects.create(empleado=self.p_gh, area='GESTION HUMANA', carpeta='GH', cargo='ANALISTA', fecha_ingreso=date.today())
        perm_todos = Permission.objects.get(codename='ver_todos_empleados', content_type__app_label='empleados')
        self.u_gh.user_permissions.add(perm_todos)

        self.u_lider = User.objects.create(username='test_lider_scope')
        self.p_lider = EmpleadoPerfil.objects.create(user=self.u_lider, numero_documento='LID_SCOPE_001', nombres='Carlos', apellidos='Lider')
        EmpleadoLaboral.objects.create(empleado=self.p_lider, area='REDES', carpeta='REDES_MED', cargo='LIDER', fecha_ingreso=date.today())
        perm_equipo = Permission.objects.get(codename='ver_equipo_empleados', content_type__app_label='empleados')
        self.u_lider.user_permissions.add(perm_equipo)

        self.u_tec_redes = User.objects.create(username='test_tec_redes_scope')
        self.p_tec_redes = EmpleadoPerfil.objects.create(user=self.u_tec_redes, numero_documento='TEC_SCOPE_001', nombres='Luis', apellidos='Redes')
        EmpleadoLaboral.objects.create(empleado=self.p_tec_redes, area='REDES', carpeta='REDES_MED', cargo='TECNICO', supervisor=self.p_lider, fecha_ingreso=date.today())

        self.u_tec_sst = User.objects.create(username='test_tec_sst_scope')
        self.p_tec_sst = EmpleadoPerfil.objects.create(user=self.u_tec_sst, numero_documento='SST_SCOPE_001', nombres='Marta', apellidos='SST')
        EmpleadoLaboral.objects.create(empleado=self.p_tec_sst, area='SST', carpeta='SST_MED', cargo='INSPECTOR', fecha_ingreso=date.today())

        self.u_sin_perfil = User.objects.create(username='test_bot_scope_sin_perfil')

    def test_superuser_ve_todos(self):
        req = self.factory.get('/empleados/perfiles/')
        req.user = self.u_admin
        self.view.request = req
        qs = self.view.get_queryset()
        self.assertGreaterEqual(qs.count(), 4)
        self.assertEqual(qs.filter(id__in=[self.p_gh.id, self.p_lider.id, self.p_tec_redes.id, self.p_tec_sst.id]).count(), 4)

    def test_gh_con_permiso_ver_todos_ve_todos(self):
        req = self.factory.get('/empleados/perfiles/')
        req.user = self.u_gh
        self.view.request = req
        qs = self.view.get_queryset()
        self.assertGreaterEqual(qs.count(), 4)
        self.assertEqual(qs.filter(id__in=[self.p_gh.id, self.p_lider.id, self.p_tec_redes.id, self.p_tec_sst.id]).count(), 4)

    def test_lider_solo_ve_su_area_y_supervisados(self):
        req = self.factory.get('/empleados/perfiles/')
        req.user = self.u_lider
        self.view.request = req
        qs = self.view.get_queryset()
        ids = set(qs.values_list('id', flat=True))
        self.assertIn(self.p_lider.id, ids)
        self.assertIn(self.p_tec_redes.id, ids)
        self.assertNotIn(self.p_tec_sst.id, ids)
        self.assertNotIn(self.p_gh.id, ids)

    def test_colaborador_regular_solo_se_ve_a_si_mismo(self):
        req = self.factory.get('/empleados/perfiles/')
        req.user = self.u_tec_redes
        self.view.request = req
        qs = self.view.get_queryset()
        ids = list(qs.values_list('id', flat=True))
        self.assertEqual(ids, [self.p_tec_redes.id])

    def test_usuario_sin_perfil_retorna_vacio_sin_error_500(self):
        req = self.factory.get('/empleados/perfiles/')
        req.user = self.u_sin_perfil
        self.view.request = req
        qs = self.view.get_queryset()
        self.assertEqual(qs.count(), 0)


class HabeasDataDocumentosTests(BaseEmpleadoTestCase):
    """
    Pruebas unitarias para la protección de Documentos de Identidad (Habeas Data - Fase 3).
    Verifica que:
    1. El serializador enmascara archivo_url en None si el usuario no tiene permiso 'ver_cedula'.
    2. El serializador entrega la URL completa a usuarios autorizados (GH / Superusuario).
    3. El endpoint seguro /documento-cedula/ bloquea a usuarios no autorizados (403/404).
    4. El endpoint seguro sirve el archivo a usuarios con permiso y registra la auditoría obligatoria.
    """

    def setUp(self):
        super().setUp()
        import os
        from django.conf import settings
        from django.contrib.auth.models import User, Permission
        from rest_framework.test import APIRequestFactory
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral, EmpleadoDocumentoAdjunto
        from apps.empleados.views.empleado_perfil_view import EmpleadoPerfilViewSet

        self.factory = APIRequestFactory()
        self.view_func = EmpleadoPerfilViewSet.as_view({'get': 'documento_cedula'})

        # Crear archivo físico de prueba
        self.cedulas_dir = os.path.join(settings.MEDIA_ROOT, 'infraestructura', 'cedulas')
        os.makedirs(self.cedulas_dir, exist_ok=True)
        self.fake_cedula_path = os.path.join(self.cedulas_dir, 'test_unit_cedula_frontal.pdf')
        with open(self.fake_cedula_path, 'wb') as f:
            f.write(b'%PDF-1.4 unit test content')

        self.u_owner = User.objects.create(username='test_owner_hd')
        self.p_owner = EmpleadoPerfil.objects.create(user=self.u_owner, numero_documento='HD_OWNER_001', nombres='Pedro', apellidos='Dueno')
        EmpleadoLaboral.objects.create(empleado=self.p_owner, area='REDES', cargo='TECNICO', fecha_ingreso=date.today())
        self.doc_cedula = EmpleadoDocumentoAdjunto.objects.create(
            empleado=self.p_owner,
            tipo_documento='CEDULA_FRONTAL',
            archivo_url='/media/infraestructura/cedulas/test_unit_cedula_frontal.pdf'
        )

        self.u_sin_perm = User.objects.create(username='test_sin_perm_hd')
        self.p_sin_perm = EmpleadoPerfil.objects.create(user=self.u_sin_perm, numero_documento='HD_SIN_001', nombres='Juan', apellidos='SinPerm')
        EmpleadoLaboral.objects.create(empleado=self.p_sin_perm, area='REDES', cargo='TECNICO', fecha_ingreso=date.today())

        self.u_gh = User.objects.create(username='test_gh_hd')
        self.p_gh = EmpleadoPerfil.objects.create(user=self.u_gh, numero_documento='HD_GH_001', nombres='Maria', apellidos='GH')
        EmpleadoLaboral.objects.create(empleado=self.p_gh, area='GESTION HUMANA', cargo='ANALISTA', fecha_ingreso=date.today())
        perm_cedula = Permission.objects.get(codename='ver_cedula', content_type__app_label='empleados')
        perm_todos = Permission.objects.get(codename='ver_todos_empleados', content_type__app_label='empleados')
        self.u_gh.user_permissions.add(perm_cedula, perm_todos)

    def tearDown(self):
        import os
        try:
            if hasattr(self, 'fake_cedula_path') and os.path.exists(self.fake_cedula_path):
                os.remove(self.fake_cedula_path)
        except Exception:
            pass
        super().tearDown()

    def test_serializer_enmascara_url_cedula_sin_permiso(self):
        from apps.empleados.serializers import EmpleadoPerfilDetailSerializer
        req = self.factory.get('/')
        req.user = self.u_sin_perm
        serializer = EmpleadoPerfilDetailSerializer(self.p_owner, context={'request': req})
        data = serializer.data

        self.assertFalse(data['puede_ver_documento_identidad'])
        doc = next(d for d in data['documentos_adjuntos'] if d['tipo_documento'] == 'CEDULA_FRONTAL')
        self.assertIsNone(doc['archivo_url'])
        self.assertFalse(doc['tiene_permiso'])
        self.assertTrue(doc['cargado'])

    def test_serializer_entrega_url_cedula_con_permiso_gh(self):
        from apps.empleados.serializers import EmpleadoPerfilDetailSerializer
        req = self.factory.get('/')
        req.user = self.u_gh
        serializer = EmpleadoPerfilDetailSerializer(self.p_owner, context={'request': req})
        data = serializer.data

        self.assertTrue(data['puede_ver_documento_identidad'])
        doc = next(d for d in data['documentos_adjuntos'] if d['tipo_documento'] == 'CEDULA_FRONTAL')
        self.assertEqual(doc['archivo_url'], '/media/infraestructura/cedulas/test_unit_cedula_frontal.pdf')
        self.assertTrue(doc['tiene_permiso'])

    def test_endpoint_bloquea_usuario_sin_permiso(self):
        from rest_framework.test import force_authenticate
        req = self.factory.get(f'/empleados/perfiles/{self.p_owner.id}/documento-cedula/?lado=frontal')
        force_authenticate(req, user=self.u_sin_perm)
        resp = self.view_func(req, pk=self.p_owner.id)
        self.assertIn(resp.status_code, [403, 404])

    def test_endpoint_exitoso_y_auditoria_con_permiso_gh(self):
        from rest_framework.test import force_authenticate
        from apps.empleados.models import EmpleadoAuditoriaLog

        logs_before = EmpleadoAuditoriaLog.objects.filter(empleado=self.p_owner, accion='CONSULTA_DOCUMENTO_SENSIBLE').count()
        req = self.factory.get(f'/empleados/perfiles/{self.p_owner.id}/documento-cedula/?lado=frontal')
        force_authenticate(req, user=self.u_gh)
        resp = self.view_func(req, pk=self.p_owner.id)

        self.assertEqual(resp.status_code, 200)
        self.assertIn('inline', resp.headers.get('Content-Disposition', ''))
        self.assertEqual(resp.headers.get('X-Content-Type-Options'), 'nosniff')

        # Verificar registro de auditoría creado
        logs_after = EmpleadoAuditoriaLog.objects.filter(empleado=self.p_owner, accion='CONSULTA_DOCUMENTO_SENSIBLE').count()
        self.assertEqual(logs_after, logs_before + 1)
        # Cerrar el archivo físico sin disparar el signal request_finished que cierra la conexión a BD
        for closable in getattr(resp, '_closable_objects', []):
            try:
                closable.close()
            except Exception:
                pass


class PermisosEtapa5Tests(BaseEmpleadoTestCase):
    """
    Etapa 5: Pruebas Automatizadas (Unit Tests) del Sistema de Permisos y Habeas Data.
    Test 1 (Alcance Líder): Un líder intenta consultar el perfil de alguien de otra área -> Recibe 404 Not Found.
    Test 2 (Cédula sin permiso): Un técnico o líder sin ver_cedula intenta abrir una cédula -> Recibe 403 Forbidden y el serializador no revela la URL.
    Test 3 (Cédula autorizada con auditoría): Un usuario de Gestión Humana descarga la cédula -> Descarga exitosa y se verifica que se creó el registro en EmpleadoAuditoriaLog.
    Test 4 (Usuario sin perfil): Usuario admin sin EmpleadoPerfil -> No genera error 500.
    """

    def setUp(self):
        super().setUp()
        import os
        from django.conf import settings
        from django.contrib.auth.models import User, Permission
        from rest_framework.test import APIRequestFactory
        from apps.empleados.models import (
            EmpleadoPerfil,
            EmpleadoLaboral,
            EmpleadoDocumentoAdjunto,
            EmpleadoAuditoriaLog,
        )
        from apps.empleados.views.empleado_perfil_view import EmpleadoPerfilViewSet

        self.factory = APIRequestFactory()
        self.view_retrieve = EmpleadoPerfilViewSet.as_view({'get': 'retrieve'})
        self.view_list = EmpleadoPerfilViewSet.as_view({'get': 'list'})
        self.view_cedula = EmpleadoPerfilViewSet.as_view({'get': 'documento_cedula'})

        # Directorio y archivo físico de prueba para cédula
        self.cedulas_dir = os.path.join(settings.MEDIA_ROOT, 'infraestructura', 'cedulas')
        os.makedirs(self.cedulas_dir, exist_ok=True)
        self.fake_cedula_path = os.path.join(self.cedulas_dir, 'test_unit_cedula_etapa5.pdf')
        with open(self.fake_cedula_path, 'wb') as f:
            f.write(b'%PDF-1.4 etapa 5 test content')

        # 1. Líder de Operaciones en área 'REDES' (con permiso 'ver_equipo_empleados')
        self.u_lider = User.objects.create(username='test_et5_lider')
        self.p_lider = EmpleadoPerfil.objects.create(
            user=self.u_lider, numero_documento='ET5_LID_001', nombres='Carlos', apellidos='Lider'
        )
        EmpleadoLaboral.objects.create(
            empleado=self.p_lider, area='REDES', carpeta='REDES_MED', cargo='LIDER', fecha_ingreso=date.today()
        )
        perm_equipo = Permission.objects.get(codename='ver_equipo_empleados', content_type__app_label='empleados')
        self.u_lider.user_permissions.add(perm_equipo)

        # 2. Técnico en su mismo equipo ('REDES') con cédula adjunta (para Test 2)
        self.u_tec_redes = User.objects.create(username='test_et5_tec_redes')
        self.p_tec_redes = EmpleadoPerfil.objects.create(
            user=self.u_tec_redes, numero_documento='ET5_TEC_001', nombres='Luis', apellidos='Redes'
        )
        EmpleadoLaboral.objects.create(
            empleado=self.p_tec_redes, area='REDES', carpeta='REDES_MED', cargo='TECNICO', fecha_ingreso=date.today()
        )
        self.doc_cedula = EmpleadoDocumentoAdjunto.objects.create(
            empleado=self.p_tec_redes,
            tipo_documento='CEDULA_FRONTAL',
            archivo_url='/media/infraestructura/cedulas/test_unit_cedula_etapa5.pdf'
        )

        # 3. Empleado de otra área ('SST') (para Test 1)
        self.u_otra_area = User.objects.create(username='test_et5_otra_area')
        self.p_otra_area = EmpleadoPerfil.objects.create(
            user=self.u_otra_area, numero_documento='ET5_OTRA_001', nombres='Marta', apellidos='SST'
        )
        EmpleadoLaboral.objects.create(
            empleado=self.p_otra_area, area='SST', carpeta='SST_MED', cargo='INSPECTOR', fecha_ingreso=date.today()
        )

        # 4. Usuario de Gestión Humana (con 'ver_cedula' y 'ver_todos_empleados') (para Test 3)
        self.u_gh = User.objects.create(username='test_et5_gh')
        self.p_gh = EmpleadoPerfil.objects.create(
            user=self.u_gh, numero_documento='ET5_GH_001', nombres='Ana', apellidos='GH'
        )
        EmpleadoLaboral.objects.create(
            empleado=self.p_gh, area='GESTION HUMANA', carpeta='GH', cargo='ANALISTA', fecha_ingreso=date.today()
        )
        perm_cedula = Permission.objects.get(codename='ver_cedula', content_type__app_label='empleados')
        perm_todos = Permission.objects.get(codename='ver_todos_empleados', content_type__app_label='empleados')
        self.u_gh.user_permissions.add(perm_cedula, perm_todos)

        # 5. Usuario Admin sin EmpleadoPerfil (para Test 4)
        self.u_admin_sin_perfil = User.objects.create(
            username='test_et5_admin_sin_perfil', is_superuser=True, is_staff=True
        )

    def tearDown(self):
        import os
        try:
            if hasattr(self, 'fake_cedula_path') and os.path.exists(self.fake_cedula_path):
                os.remove(self.fake_cedula_path)
        except Exception:
            pass
        super().tearDown()

    def test_1_alcance_lider_consulta_otra_area_recibe_404(self):
        """
        Test 1 (Alcance Líder): Un líder intenta consultar el perfil de alguien de otra área -> Recibe 404 Not Found.
        """
        from rest_framework.test import force_authenticate
        req = self.factory.get(f'/empleados/perfiles/{self.p_otra_area.id}/')
        force_authenticate(req, user=self.u_lider)
        resp = self.view_retrieve(req, pk=self.p_otra_area.id)
        self.assertEqual(resp.status_code, 404)

    def test_2_cedula_sin_permiso_recibe_403_y_url_enmascarada(self):
        """
        Test 2 (Cédula sin permiso): Un técnico o líder sin ver_cedula intenta abrir una cédula -> Recibe 403 Forbidden
        y el serializador no revela la URL física (archivo_url = None).
        """
        from rest_framework.test import force_authenticate
        from apps.empleados.serializers import EmpleadoPerfilDetailSerializer

        # 2a. Intento del líder (sin 'ver_cedula') de abrir la cédula de un colaborador de su equipo
        req = self.factory.get(f'/empleados/perfiles/{self.p_tec_redes.id}/documento-cedula/?lado=frontal')
        force_authenticate(req, user=self.u_lider)
        resp = self.view_cedula(req, pk=self.p_tec_redes.id)
        self.assertEqual(resp.status_code, 403)

        # 2b. El serializador enmascara la URL en None para usuario sin permiso
        req_ser = self.factory.get('/')
        req_ser.user = self.u_lider
        serializer = EmpleadoPerfilDetailSerializer(self.p_tec_redes, context={'request': req_ser})
        data = serializer.data
        self.assertFalse(data['puede_ver_documento_identidad'])
        doc = next(d for d in data['documentos_adjuntos'] if d['tipo_documento'] == 'CEDULA_FRONTAL')
        self.assertIsNone(doc['archivo_url'])
        self.assertFalse(doc['tiene_permiso'])
        self.assertTrue(doc['cargado'])

    def test_3_cedula_autorizada_gh_descarga_exitosa_y_auditoria(self):
        """
        Test 3 (Cédula autorizada con auditoría): Un usuario de Gestión Humana descarga la cédula ->
        Descarga exitosa (200 OK) y se verifica que se creó el registro en EmpleadoAuditoriaLog.
        """
        from rest_framework.test import force_authenticate
        from apps.empleados.models import EmpleadoAuditoriaLog

        logs_before = EmpleadoAuditoriaLog.objects.filter(
            empleado=self.p_tec_redes, accion='CONSULTA_DOCUMENTO_SENSIBLE'
        ).count()

        req = self.factory.get(f'/empleados/perfiles/{self.p_tec_redes.id}/documento-cedula/?lado=frontal')
        force_authenticate(req, user=self.u_gh)
        resp = self.view_cedula(req, pk=self.p_tec_redes.id)

        self.assertEqual(resp.status_code, 200)
        self.assertIn('inline', resp.headers.get('Content-Disposition', ''))
        self.assertEqual(resp.headers.get('X-Content-Type-Options'), 'nosniff')

        # Cerrar el archivo físico sin disparar el signal request_finished que cierra la conexión a BD
        for closable in getattr(resp, '_closable_objects', []):
            try:
                closable.close()
            except Exception:
                pass

        # Verificar que se creó el registro en EmpleadoAuditoriaLog
        logs_after = EmpleadoAuditoriaLog.objects.filter(
            empleado=self.p_tec_redes, accion='CONSULTA_DOCUMENTO_SENSIBLE'
        ).count()
        self.assertEqual(logs_after, logs_before + 1)

    def test_4_usuario_admin_sin_perfil_no_genera_500(self):
        """
        Test 4 (Usuario sin perfil): Usuario admin sin EmpleadoPerfil -> No genera error 500.
        """
        from rest_framework.test import force_authenticate
        req = self.factory.get('/empleados/perfiles/')
        force_authenticate(req, user=self.u_admin_sin_perfil)
        resp = self.view_list(req)
        self.assertEqual(resp.status_code, 200)
        self.assertNotEqual(resp.status_code, 500)


class RestablecerContrasenaTests(BaseEmpleadoTestCase):
    """
    Pruebas unitarias para la funcionalidad de restablecer / restaurar contraseña
    de acceso del colaborador (Regla Legacy: restaurarcontra, línea 2009).
    """

    def setUp(self):
        super().setUp()
        from django.contrib.auth.models import User, Permission
        from rest_framework.test import APIRequestFactory
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral
        from apps.empleados.views.empleado_perfil_view import EmpleadoPerfilViewSet

        self.factory = APIRequestFactory()
        self.view_reset = EmpleadoPerfilViewSet.as_view({'post': 'restablecer_contrasena'})

        # Operador de Gestión Humana
        self.u_operador = User.objects.create_user(username='test_op_reset', password='OpPassword123!')
        perm_todos = Permission.objects.get(codename='ver_todos_empleados', content_type__app_label='empleados')
        self.u_operador.user_permissions.add(perm_todos)

        # Colaborador objetivo
        self.u_colaborador = User.objects.create_user(username='test_colab_reset', password='OldPassword123!')
        self.p_colaborador = EmpleadoPerfil.objects.create(
            user=self.u_colaborador,
            numero_documento='1020304050',
            nombres='Pedro',
            apellidos='Perez'
        )
        EmpleadoLaboral.objects.create(
            empleado=self.p_colaborador,
            area='OPERACIONES',
            cargo='TECNICO',
            fecha_ingreso=date.today()
        )

        # Superadministrador
        self.u_super = User.objects.create_superuser(username='test_super_reset', password='SuperPassword123!', email='super@cinco.com')
        self.p_super = EmpleadoPerfil.objects.create(
            user=self.u_super,
            numero_documento='999999999',
            nombres='Admin',
            apellidos='General'
        )

    def test_restablecer_contrasena_servicio_exitoso(self):
        """
        El servicio genera una clave que cumple la política de complejidad,
        actualiza la contraseña del usuario y registra la traza de auditoría sin exponer la clave.
        """
        from apps.empleados.services.empleado_workflow_service import EmpleadoWorkflowService
        from apps.empleados.models import EmpleadoAuditoriaLog
        from apps.authentication.password_validators import ComplexityPasswordValidator

        res = EmpleadoWorkflowService.restablecer_contrasena(
            perfil=self.p_colaborador,
            operador=self.u_operador,
            ip_origen='192.168.1.50'
        )

        self.assertTrue(res['success'])
        temp_pwd = res['temp_password']
        self.assertTrue(temp_pwd)

        # 1. Cumple ComplexityPasswordValidator
        validator = ComplexityPasswordValidator()
        validator.validate(temp_pwd)

        # 2. El usuario puede autenticarse con la nueva contraseña y no con la anterior
        self.u_colaborador.refresh_from_db()
        self.assertTrue(self.u_colaborador.check_password(temp_pwd))
        self.assertFalse(self.u_colaborador.check_password('OldPassword123!'))

        # 3. Auditoría registrada en EmpleadoAuditoriaLog
        log = EmpleadoAuditoriaLog.objects.filter(
            empleado=self.p_colaborador, accion='RESTABLECER_CONTRASENA'
        ).latest('created_at')
        self.assertEqual(log.usuario, self.u_operador)
        self.assertEqual(log.ip_origen, '192.168.1.50')
        # La clave en claro NUNCA se guarda en el log
        self.assertNotIn(temp_pwd, str(log.datos_nuevos))

    def test_restablecer_contrasena_api_endpoint_200(self):
        """
        El endpoint POST /empleados/perfiles/{pk}/restablecer-contrasena/ retorna 200 OK con la clave temporal.
        """
        from rest_framework.test import force_authenticate

        req = self.factory.post(f'/empleados/perfiles/{self.p_colaborador.id}/restablecer-contrasena/')
        force_authenticate(req, user=self.u_operador)
        resp = self.view_reset(req, pk=self.p_colaborador.id)

        self.assertEqual(resp.status_code, 200)
        data = resp.data
        self.assertTrue(data['success'])
        self.assertEqual(data['username'], self.u_colaborador.username)
        self.assertTrue(len(data['temp_password']) >= 8)

    def test_restablecer_contrasena_superusuario_bloqueado_403(self):
        """
        No se puede restablecer la contraseña de un superadministrador desde este endpoint (403 Forbidden).
        """
        from rest_framework.test import force_authenticate

        req = self.factory.post(f'/empleados/perfiles/{self.p_super.id}/restablecer-contrasena/')
        force_authenticate(req, user=self.u_operador)
        resp = self.view_reset(req, pk=self.p_super.id)

        self.assertEqual(resp.status_code, 403)
        self.assertIn('superadministrador', resp.data['error'].lower())


class InmutabilidadNumeroDocumentoTests(BaseEmpleadoTestCase):
    """
    Pruebas unitarias para la inmutabilidad y protección del número de documento (Cédula).
    """

    def setUp(self):
        super().setUp()
        from django.contrib.auth.models import User, Permission
        from apps.empleados.models import EmpleadoPerfil
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoPerfilDetailSerializer

        self.u_colab = User.objects.create_user(username='1099887766', password='ColabPassword123!')
        self.perfil = EmpleadoPerfil.objects.create(
            user=self.u_colab,
            numero_documento='1099887766',
            tipo_documento='CC',
            nombres='CARLOS',
            apellidos='GOMEZ',
            estado='ACTIVO'
        )

    def test_modificar_numero_documento_falla_con_validation_error(self):
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoPerfilDetailSerializer
        from rest_framework.exceptions import ValidationError

        serializer = EmpleadoPerfilDetailSerializer(
            instance=self.perfil,
            data={'numero_documento': '9999999999'},
            partial=True
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('numero_documento', serializer.errors)
        self.assertIn('no puede ser modificado', str(serializer.errors['numero_documento'][0]))

    def test_actualizar_otros_campos_manteniendo_documento_exitoso(self):
        from apps.empleados.serializers.empleado_perfil_serializer import EmpleadoPerfilDetailSerializer

        serializer = EmpleadoPerfilDetailSerializer(
            instance=self.perfil,
            data={'numero_documento': '1099887766', 'nombres': 'CARLOS ALBERTO'},
            partial=True
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()
        self.assertEqual(updated.nombres, 'CARLOS ALBERTO')
        self.assertEqual(updated.numero_documento, '1099887766')


class HistorialDotacionIntegralTests(TestCase):
    databases = {'default', 'azul'}

    def setUp(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient
        from apps.empleados.models import EmpleadoPerfil, EmpleadoDotacionComprobante
        from datetime import date

        self.user = User.objects.create_user(username='admin_dotacion', password='AdminPassword123!', is_staff=True)
        self.perfil = EmpleadoPerfil.objects.create(
            user=self.user,
            numero_documento='1088776655',
            tipo_documento='CC',
            nombres='MARIO',
            apellidos='VALENCIA',
            estado='ACTIVO'
        )
        self.comprobante = EmpleadoDotacionComprobante.objects.create(
            empleado=self.perfil,
            fecha_entrega=date(2026, 5, 10),
            observaciones='Entrega dotacion semestral',
            archivo_url='/media/infraestructura/dotacion/acta_test.pdf',
            subido_por=self.user
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_endpoint_dotacion_integral_retorna_estructura_completa(self):
        url = f"/empleados/perfiles/{self.perfil.id}/dotacion-integral/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get('success'))
        self.assertIn('actas_comprobantes', data)
        self.assertIn('despachos_bodega', data)
        self.assertIn('cnt_actas', data)
        self.assertIn('cnt_despachos', data)
        self.assertGreaterEqual(data['cnt_actas'], 1)

        # Verificar que el comprobante local tiene el origen APP_CINCO y es eliminable
        acta_local = next((a for a in data['actas_comprobantes'] if a['comprobante_id'] == self.comprobante.id), None)
        self.assertIsNotNone(acta_local)
        self.assertEqual(acta_local['origen'], 'APP_CINCO')
        self.assertTrue(acta_local['es_eliminable'])

    def test_serializers_incluyen_campo_cnt_dotacion(self):
        from apps.empleados.serializers import EmpleadoPerfilListSerializer, EmpleadoPerfilDetailSerializer

        # Detail Serializer
        detail_ser = EmpleadoPerfilDetailSerializer(self.perfil)
        self.assertIn('cnt_dotacion', detail_ser.data)
        self.assertGreaterEqual(detail_ser.data['cnt_dotacion'], 1)

        # List Serializer
        list_ser = EmpleadoPerfilListSerializer(self.perfil)
        self.assertIn('cnt_dotacion', list_ser.data)
        self.assertGreaterEqual(list_ser.data['cnt_dotacion'], 1)

    def test_dotacion_integral_unifica_legacy_y_logistica_con_mocks(self):
        from unittest.mock import patch, MagicMock
        from datetime import datetime, date
        from apps.empleados.services import EmpleadoWorkflowService

        with patch('apps.empleados.services.empleado_workflow_service.connections') as mock_conn:
            mock_cursor = MagicMock()
            mock_cursor.fetchall.side_effect = [
                # 1. sst_base_entrega_dotacion
                [(99, date(2024, 2, 16), 'solicitudes/dotacion/1088776655_acta.jpeg', '1088776655', datetime(2024, 2, 16, 9, 30))],
                # 2. control_inventario_movimientos_entrega
                [(501, datetime(2026, 10, 26, 11, 30), 'TICK123', 'BOT_SEG_42', 'BOTA DE SEGURIDAD 42', '42', 1, 'MEDELLIN', 'Entrega regular')]
            ]
            mock_cursor.__enter__.return_value = mock_cursor
            mock_conn.__getitem__.return_value.cursor.return_value = mock_cursor

            res = EmpleadoWorkflowService.consultar_historial_dotacion_integral(self.perfil.id, self.perfil.numero_documento)
            self.assertTrue(res['success'])
            self.assertEqual(res['cnt_actas'], 2)  # 1 local + 1 legacy
            self.assertEqual(res['cnt_despachos'], 1)
            self.assertEqual(res['despachos_bodega'][0]['codigo'], 'BOT_SEG_42')
            self.assertEqual(res['despachos_bodega'][0]['descripcion'], 'BOTA DE SEGURIDAD 42')
            self.assertEqual(res['despachos_bodega'][0]['talla'], '42')
            self.assertEqual(res['despachos_bodega'][0]['cantidad'], 1)


class SincronizacionCruzadaTransporteAzulTests(TestCase):
    """
    Pruebas para el Punto 2.3: Sincronización Cruzada con Módulo de Transporte
    y Registros de Salida (transportadores_vehiculos y transporte_registro_salida en base azul).
    """
    databases = {'default', 'azul'}

    def setUp(self):
        from django.contrib.auth import get_user_model
        from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral, EmpleadoMovilidad
        import uuid

        User = get_user_model()
        uid = uuid.uuid4().hex[:8]
        self.user_op = User.objects.create_user(username=f'op_{uid}', email=f'op_{uid}@cinco.com', password='pwd')
        self.user_emp = User.objects.create_user(username=f'emp_{uid}', email=f'emp_{uid}@cinco.com', password='pwd')
        self.perfil = EmpleadoPerfil.objects.create(
            user=self.user_emp,
            numero_documento=f'98{uid[:6]}',
            tipo_documento='CC',
            nombres='CARLOS',
            apellidos='RESTREPO'
        )
        self.laboral = EmpleadoLaboral.objects.create(
            empleado=self.perfil,
            fecha_ingreso=date.today(),
            area='OPERACIONES',
            carpeta='ANTIOQUIA',
            cargo='TECNICO ENLACE'
        )
        self.movilidad = EmpleadoMovilidad.objects.create(
            empleado=self.perfil,
            sabe_conducir=True,
            medio_transporte='CARRO'
        )

    def test_sincronizar_vehiculo_estandar_sin_pago_mensual(self):
        """
        Al asignar una placa a un colaborador, debe actualizar cinco_base_de_personal
        y transportadores_vehiculos (cedual_conductor). Si no tiene pago mensual, no toca salidas.
        """
        from unittest.mock import patch, MagicMock
        from apps.empleados.services import EmpleadoWorkflowService

        with patch('apps.empleados.services.empleado_workflow_service.connections') as mock_conn:
            mock_cursor = MagicMock()
            # Pago mensual query returns None (no pago mensual)
            mock_cursor.fetchone.return_value = None
            mock_cursor.rowcount = 1
            mock_cursor.__enter__.return_value = mock_cursor
            mock_conn.__getitem__.return_value.cursor.return_value = mock_cursor

            res = EmpleadoWorkflowService.sincronizar_placa_legacy_transporte(
                empleado_perfil=self.perfil,
                nueva_placa='XYZ789',
                conduce=True,
                medio_transporte='CARRO',
                user_operator=self.user_op
            )

            self.assertTrue(res['placa_actualizada'])
            self.assertTrue(res['vehiculo_actualizado'])
            self.assertFalse(res['pago_mensual_aplica'])
            self.assertEqual(res['salidas_actualizadas'], 0)
            self.assertEqual(len(res['errores']), 0)

            # Verificar que ejecutó el update de transportadores_vehiculos
            executed_sqls = [call[0][0] for call in mock_cursor.execute.call_args_list]
            self.assertTrue(any('transportadores_vehiculos' in sql and 'cedual_conductor' in sql for sql in executed_sqls))
            self.assertTrue(any('cinco_base_de_personal' in sql for sql in executed_sqls))

    def test_sincronizar_vehiculo_con_pago_mensual_y_salidas_completas(self):
        """
        Si el vehículo tiene modalidad pago mensual para el mes actual y
        coincide la cantidad de registros con los días del mes, actualiza transporte_registro_salida.
        """
        from unittest.mock import patch, MagicMock
        from apps.empleados.services import EmpleadoWorkflowService
        import calendar
        from django.utils import timezone
        from datetime import date

        hoy = timezone.localdate() if timezone.is_aware(timezone.now()) else date.today()
        _, ultimo_dia = calendar.monthrange(hoy.year, hoy.month)
        dias_mes = ultimo_dia

        with patch('apps.empleados.services.empleado_workflow_service.connections') as mock_conn:
            mock_cursor = MagicMock()
            # 1. fetchone para pago mensual: retorna registro encontrado
            # 2. fetchone para COUNT(*) de registros de salida: retorna dias_mes
            mock_cursor.fetchone.side_effect = [
                (10, 'SNW972', 60000),  # Vehículo con pago mensual
                (dias_mes,)              # Cantidad exacta de salidas generadas
            ]
            mock_cursor.rowcount = dias_mes
            mock_cursor.__enter__.return_value = mock_cursor
            mock_conn.__getitem__.return_value.cursor.return_value = mock_cursor

            res = EmpleadoWorkflowService.sincronizar_placa_legacy_transporte(
                empleado_perfil=self.perfil,
                nueva_placa='SNW972',
                conduce=True,
                medio_transporte='CARRO',
                user_operator=self.user_op
            )

            self.assertTrue(res['placa_actualizada'])
            self.assertTrue(res['pago_mensual_aplica'])
            self.assertEqual(res['salidas_actualizadas'], dias_mes)
            self.assertEqual(len(res['errores']), 0)

            # Verificar que ejecutó el UPDATE sobre transporte_registro_salida
            executed_sqls = [call[0][0] for call in mock_cursor.execute.call_args_list]
            self.assertTrue(any('UPDATE transporte_registro_salida' in sql for sql in executed_sqls))

    def test_liberar_placa_previa_al_reasignar(self):
        """
        Al cambiar de placa 'AAA111' a 'BBB222', debe liberar 'AAA111' y asignar 'BBB222'.
        """
        from unittest.mock import patch, MagicMock
        from apps.empleados.services import EmpleadoWorkflowService

        with patch('apps.empleados.services.empleado_workflow_service.connections') as mock_conn:
            mock_cursor = MagicMock()
            mock_cursor.fetchone.return_value = None
            mock_cursor.rowcount = 1
            mock_cursor.__enter__.return_value = mock_cursor
            mock_conn.__getitem__.return_value.cursor.return_value = mock_cursor

            res = EmpleadoWorkflowService.sincronizar_placa_legacy_transporte(
                empleado_perfil=self.perfil,
                nueva_placa='BBB222',
                placa_anterior='AAA111',
                user_operator=self.user_op
            )

            self.assertTrue(res['placa_actualizada'])
            executed_sqls = [call[0][0] for call in mock_cursor.execute.call_args_list]
            # Debe haber liberado la previa
            self.assertTrue(any('cedual_conductor = \'\'' in sql for sql in executed_sqls))

    def test_workflow_asignar_placa_vehiculo_integra_sincronizacion(self):
        """
        Verifica que EmpleadoWorkflowService.asignar_placa_vehiculo invoque
        la sincronización cruzada y guarde la trazabilidad en EmpleadoMovilidad.
        """
        from unittest.mock import patch
        from apps.empleados.services import EmpleadoWorkflowService

        with patch.object(EmpleadoWorkflowService, 'sincronizar_placa_legacy_transporte') as mock_sync:
            mock_sync.return_value = {
                'placa_actualizada': True,
                'vehiculo_actualizado': True,
                'salidas_actualizadas': 0,
                'pago_mensual_aplica': False,
                'errores': []
            }

            mov = EmpleadoWorkflowService.asignar_placa_vehiculo(
                empleado_id=self.perfil.id,
                placa='KTM390',
                conduce=True,
                medio_transporte='MOTO',
                user_operator=self.user_op
            )

            self.assertEqual(mov.placa_vehiculo, 'KTM390')
            self.assertTrue(mov.sabe_conducir)
            self.assertEqual(mov.medio_transporte, 'MOTO')

            mock_sync.assert_called_once()
            called_kwargs = mock_sync.call_args.kwargs
            self.assertEqual(called_kwargs['nueva_placa'], 'KTM390')
            self.assertEqual(called_kwargs['empleado_perfil'].id, self.perfil.id)

    def test_resiliencia_si_falla_conexion_base_azul(self):
        """
        Si la conexión con la base azul falla, el error es capturado y no rompe
        la operación local en App Cinco.
        """
        from unittest.mock import patch
        from apps.empleados.services import EmpleadoWorkflowService

        with patch('apps.empleados.services.empleado_workflow_service.connections') as mock_conn:
            mock_conn.__getitem__.side_effect = Exception("Conexión rechazada a bd_c3nc4s1s")

            res = EmpleadoWorkflowService.sincronizar_placa_legacy_transporte(
                empleado_perfil=self.perfil,
                nueva_placa='ERR404',
                user_operator=self.user_op
            )

            self.assertFalse(res['placa_actualizada'])
            self.assertEqual(len(res['errores']), 1)
            self.assertIn("Conexión rechazada", res['errores'][0])





