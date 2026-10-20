from datetime import date
from decimal import Decimal
from unittest import TestCase
from unittest.mock import MagicMock, patch

from rest_framework.parsers import FormParser, JSONParser
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from apps.empleados.services.empleado_service import EmpleadoService
from apps.empleados.views.empleado_view import EmpleadoViewSet


class EmpleadoServiceTests(TestCase):
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


class EmpleadoViewSetTests(TestCase):
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


class EmpleadoContactoPerfilUpdateTests(TestCase):
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


class EmpleadoCertificacionesSSTTests(TestCase):
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

        # 3. Eliminar Certificado Alturas
        req_del = factory.delete(f'/empleados/perfiles/{self.perfil.id}/documentos/CERTIFICADO_ALTURAS/')
        force_authenticate(req_del, user=self.user)
        resp3 = view(req_del, pk=self.perfil.id, tipo_documento='CERTIFICADO_ALTURAS')
        self.assertEqual(resp3.status_code, 200)

        sst.refresh_from_db()
        self.assertIsNone(sst.certificado_alturas_url)


class EmpleadoDotacionActivosTests(TestCase):
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


class EmpleadoMovilidadTests(TestCase):
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


class EmpleadoContactoEmergenciaTests(TestCase):
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
