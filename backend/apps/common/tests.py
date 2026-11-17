from unittest import TestCase
from datetime import date, timedelta
from unittest.mock import patch

from django.test import TestCase as DjangoTestCase, override_settings
from django.core import mail
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db import transaction

from rest_framework import status
from rest_framework.exceptions import ValidationError
from apps.common.exceptions import custom_exception_handler
from apps.common.models.notificacion_correo import NotificacionCorreo
from apps.common.services.notificacion_correo_service import NotificacionCorreoService
from apps.empleados.models.perfil_model import EmpleadoPerfil
from apps.empleados.models.laboral_model import EmpleadoLaboral
from apps.empleados.models.contacto_model import EmpleadoContacto
from apps.empleados.services.empleado_workflow_service import EmpleadoWorkflowService

User = get_user_model()


class CustomExceptionHandlerTests(TestCase):
    def test_maneja_excepcion_estandar_de_drf(self):
        exc = ValidationError({"campo": ["Este campo es obligatorio."]})
        context = {"view": None}
        response = custom_exception_handler(exc, context)

        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("campo", response.data)

    def test_captura_excepcion_no_controlada_y_retorna_json_500(self):
        exc = ValueError("Error inesperado en lógica de negocio")
        context = {"view": None}
        response = custom_exception_handler(exc, context)

        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn("detail", response.data)
        self.assertNotIn("<html", str(response.data))
        self.assertEqual(
            response.data["detail"],
            "Ocurrió un error interno en el servidor. Por favor, intenta nuevamente más tarde.",
        )


class NotificacionCorreoOutboxTests(DjangoTestCase):
    databases = {'default', 'azul'}

    def setUp(self):
        self.user_op = User.objects.create_user(
            username='operador_gh',
            email='operador@cincosas.com',
            first_name='Laura',
            last_name='Gomez'
        )
        self.user_emp = User.objects.create_user(
            username='1098765432',
            email='carlos.perez@cincosas.com',
            first_name='Carlos',
            last_name='Perez'
        )
        self.perfil = EmpleadoPerfil.objects.create(
            user=self.user_emp,
            tipo_documento='CC',
            numero_documento='1098765432',
            nombres='Carlos',
            apellidos='Perez',
            estado='ACTIVO'
        )
        self.laboral = EmpleadoLaboral.objects.create(
            empleado=self.perfil,
            cargo='TECNICO INTEGRAL',
            area='OPERACIONES',
            carpeta='FIBRA OPTICA',
            movil='TIRAN-01',
            fecha_ingreso=date.today()
        )
        mail.outbox.clear()

    def test_01_encolado_atomico_e_idempotencia_en_bd(self):
        """Verifica que el encolado registre NotificacionCorreo y que eventos con igual key no se dupliquen."""
        idempotency_key = f"test:egreso:{self.perfil.id}:2026-11-13"
        destinatarios = ['juridica@cincosas.com', 'lidersst@cincosas.com']

        # Primer intento
        notif1 = NotificacionCorreoService.encolar(
            evento='EGRESO',
            idempotency_key=idempotency_key,
            destinatarios=destinatarios,
            asunto='Prueba Egreso',
            plantilla='emails/notificacion_egreso.html',
            contexto={'nombre_completo': 'Carlos Perez', 'motivo': 'Fin de contrato'},
            ejecutar_inmediato=False
        )

        self.assertIsNotNone(notif1.id)
        self.assertEqual(notif1.estado, NotificacionCorreo.ESTADO_PENDIENTE)
        self.assertEqual(notif1.destinatarios_previstos, destinatarios)

        # Segundo intento con la misma clave (simulando doble clic)
        notif2 = NotificacionCorreoService.encolar(
            evento='EGRESO',
            idempotency_key=idempotency_key,
            destinatarios=destinatarios,
            asunto='Prueba Egreso Doble Clic',
            plantilla='emails/notificacion_egreso.html',
            contexto={'nombre_completo': 'Carlos Perez'},
            ejecutar_inmediato=False
        )

        self.assertEqual(notif1.id, notif2.id)
        self.assertEqual(NotificacionCorreo.objects.filter(idempotency_key=idempotency_key).count(), 1)

    @override_settings(DEBUG=True, EMAIL_DEV_OVERRIDE='sandbox@cincosas.com')
    def test_02_sandbox_fail_safe_en_desarrollo(self):
        """Con DEBUG=True, todos los envíos deben redirigirse a EMAIL_DEV_OVERRIDE con prefijo [SANDBOX]."""
        idempotency_key = f"test:sandbox:{self.perfil.id}"
        destinatarios_oficiales = ['gerencia@cincosas.com', 'juridica@cincosas.com']

        NotificacionCorreoService.encolar(
            evento='EGRESO',
            idempotency_key=idempotency_key,
            destinatarios=destinatarios_oficiales,
            asunto='Retiro Oficial',
            plantilla='emails/notificacion_egreso.html',
            contexto={'nombre_completo': 'Carlos Perez', 'motivo': 'Renuncia'},
            ejecutar_inmediato=False
        )

        summary = NotificacionCorreoService.procesar_pendientes(batch_size=10)
        self.assertEqual(summary['enviados'], 1)

        # Validar en base de datos
        notif = NotificacionCorreo.objects.get(idempotency_key=idempotency_key)
        self.assertEqual(notif.estado, NotificacionCorreo.ESTADO_ENVIADO)
        self.assertEqual(notif.destinatarios_previstos, destinatarios_oficiales)
        self.assertEqual(notif.destinatarios_reales, ['sandbox@cincosas.com'])

        # Validar el correo despachado por Django mail
        self.assertEqual(len(mail.outbox), 1)
        enviado = mail.outbox[0]
        self.assertEqual(enviado.to, ['sandbox@cincosas.com'])
        self.assertIn('[SANDBOX]', enviado.subject)

    @override_settings(DEBUG=False)
    def test_03_modo_produccion_envia_a_destinatarios_reales(self):
        """Con DEBUG=False, los correos se envían a los destinatarios oficiales sin prefijo [SANDBOX]."""
        idempotency_key = f"test:prod:{self.perfil.id}"
        destinatarios_oficiales = ['juridica@cincosas.com', 'lidersst@cincosas.com']

        NotificacionCorreoService.encolar(
            evento='EGRESO',
            idempotency_key=idempotency_key,
            destinatarios=destinatarios_oficiales,
            asunto='Retiro Definitivo',
            plantilla='emails/notificacion_egreso.html',
            contexto={'nombre_completo': 'Carlos Perez', 'motivo': 'Fin de obra'},
            ejecutar_inmediato=False
        )

        summary = NotificacionCorreoService.procesar_pendientes(batch_size=10)
        self.assertEqual(summary['enviados'], 1)

        enviado = mail.outbox[0]
        self.assertEqual(enviado.to, destinatarios_oficiales)
        self.assertNotIn('[SANDBOX]', enviado.subject)

    def test_04_rescate_automatico_de_registros_zombi(self):
        """Registros que quedaron en PROCESANDO por más de 5 min deben volver a REINTENTO."""
        hace_diez_min = timezone.now() - timedelta(minutes=10)
        zombie = NotificacionCorreo.objects.create(
            idempotency_key='test:zombie:1',
            evento='EGRESO',
            destinatarios_previstos=['juridica@cincosas.com'],
            asunto='Mensaje Colgado',
            plantilla='emails/notificacion_egreso.html',
            contexto={'nombre_completo': 'Carlos Perez'},
            estado=NotificacionCorreo.ESTADO_PROCESANDO,
            procesando_desde=hace_diez_min
        )

        summary = NotificacionCorreoService.procesar_pendientes(batch_size=10)
        self.assertGreaterEqual(summary['zombies_rescatados'], 1)

        zombie.refresh_from_db()
        # Al ser rescatado a REINTENTO, el mismo lote lo procesa y envía
        self.assertEqual(zombie.estado, NotificacionCorreo.ESTADO_ENVIADO)

    @patch('django.core.mail.EmailMultiAlternatives.send')
    def test_05_reintentos_backoff_exponencial_y_estado_terminal_fallido(self, mock_send):
        """Verifica que ante errores SMTP aplique reintentos y transicione a FALLIDO al 3er intento."""
        mock_send.side_effect = Exception("Conexión rechazada por servidor SMTP")

        idempotency_key = 'test:falla:1'
        notif = NotificacionCorreoService.encolar(
            evento='EGRESO',
            idempotency_key=idempotency_key,
            destinatarios=['juridica@cincosas.com'],
            asunto='Falla Reintentable',
            plantilla='emails/notificacion_egreso.html',
            contexto={'nombre_completo': 'Carlos Perez'},
            ejecutar_inmediato=False
        )

        # Intento 1
        summary1 = NotificacionCorreoService.procesar_pendientes(batch_size=10)
        self.assertEqual(summary1['reintentos'], 1)
        notif.refresh_from_db()
        self.assertEqual(notif.estado, NotificacionCorreo.ESTADO_REINTENTO)
        self.assertEqual(notif.intentos, 1)

        # Intento 2 (simulamos que el tiempo del backoff ya pasó)
        notif.proximo_intento = timezone.now() - timedelta(seconds=1)
        notif.save()
        summary2 = NotificacionCorreoService.procesar_pendientes(batch_size=10)
        self.assertEqual(summary2['reintentos'], 1)
        notif.refresh_from_db()
        self.assertEqual(notif.intentos, 2)
        self.assertEqual(notif.estado, NotificacionCorreo.ESTADO_REINTENTO)

        # Intento 3 (alcanza max_intentos = 3 -> FALLIDO terminal)
        notif.proximo_intento = timezone.now() - timedelta(seconds=1)
        notif.save()
        summary3 = NotificacionCorreoService.procesar_pendientes(batch_size=10)
        self.assertEqual(summary3['fallidos'], 1)
        notif.refresh_from_db()
        self.assertEqual(notif.intentos, 3)
        self.assertEqual(notif.estado, NotificacionCorreo.ESTADO_FALLIDO)
        self.assertIn("Conexión rechazada", notif.ultimo_error)

    def test_06_integracion_desactivar_empleado_encola_egreso_sin_motivo_real(self):
        """Al desactivar un empleado, se encola la notificación de EGRESO sin exponer motivo_real (Habeas Data)."""
        EmpleadoWorkflowService.desactivar_empleado(
            empleado_id=self.perfil.id,
            fecha_egreso=date.today(),
            motivo='Terminacion de contrato por mutuo acuerdo',
            motivo_real='CONFIDENCIAL: Proceso disciplinario interno',
            user_operator=self.user_op
        )

        notif = NotificacionCorreo.objects.filter(
            evento='EGRESO',
            contexto__empleado_id=self.perfil.id
        ).first()

        self.assertIsNotNone(notif)
        self.assertEqual(notif.estado, NotificacionCorreo.ESTADO_PENDIENTE)
        self.assertEqual(notif.contexto['motivo'], 'Terminacion de contrato por mutuo acuerdo')
        # Garantía Habeas Data: motivo_real no viaja en el contexto del correo
        self.assertNotIn('motivo_real', notif.contexto)
        self.assertNotIn('CONFIDENCIAL', str(notif.contexto))

    def test_07_integracion_reactivar_empleado_encola_notificacion(self):
        """Al reactivar a un empleado, se encola la notificación de REACTIVACION con su móvil asignado."""
        self.perfil.estado = 'INACTIVO'
        self.perfil.save()
        self.laboral.movil = 'Z - FUERA DE OPERACION'
        self.laboral.save()

        EmpleadoWorkflowService.reactivar_empleado(
            empleado_id=self.perfil.id,
            movil_inicial='TIRAN-02',
            user_operator=self.user_op
        )

        notif = NotificacionCorreo.objects.filter(
            evento='REACTIVACION',
            contexto__empleado_id=self.perfil.id
        ).first()

        self.assertIsNotNone(notif)
        self.assertEqual(notif.estado, NotificacionCorreo.ESTADO_PENDIENTE)
        self.assertEqual(notif.contexto['movil'], 'TIRAN-02')

    def test_08_integracion_solicitar_traslado_encola_notificacion(self):
        """Al solicitar cambio de área y carpeta, se encola la notificación para GH y Programación."""
        notif = EmpleadoWorkflowService.solicitar_cambio_area(
            empleado_id=self.perfil.id,
            solicitante_usuario=self.user_op,
            nueva_area='PROGRAMACION',
            nueva_carpeta='DESPACHO',
            motivo='Traslado por necesidades del servicio'
        )

        self.assertIsNotNone(notif)
        self.assertEqual(notif.evento, 'SOLICITUD_TRASLADO')
        self.assertEqual(notif.contexto['area_nueva'], 'PROGRAMACION')
        self.assertEqual(notif.contexto['carpeta_nueva'], 'DESPACHO')
        self.assertEqual(notif.contexto['motivo'], 'Traslado por necesidades del servicio')

    def test_09_encolar_alerta_periodo_prueba(self):
        """Verifica el encolado de alertas de período de prueba con cálculo de días y destinatarios."""
        from datetime import timedelta
        self.laboral.fecha_ingreso = timezone.now().date() - timedelta(days=50)
        self.laboral.save()

        sup_user = User.objects.create_user(username='sup_test', email='sup@cincosas.com')
        sup_perfil = EmpleadoPerfil.objects.create(
            user=sup_user,
            tipo_documento='CC',
            numero_documento='9876543210',
            nombres='Mario',
            apellidos='Supervisor',
            estado='ACTIVO'
        )
        EmpleadoContacto.objects.create(
            empleado=sup_perfil,
            correo_corporativo='mario.supervisor@cincosas.com'
        )
        self.laboral.supervisor = sup_perfil
        self.laboral.save()

        notif, total, creado = NotificacionCorreoService.encolar_alerta_periodo_prueba(
            usuario_operador=self.user_op,
            forzar=True
        )

        self.assertIsNotNone(notif)
        self.assertGreaterEqual(total, 1)
        self.assertTrue(creado)
        self.assertEqual(notif.evento, 'ALERTA_PERIODO_PRUEBA')
        self.assertIn('mario.supervisor@cincosas.com', notif.destinatarios_previstos)
        colab = notif.contexto['colaboradores'][0]
        self.assertTrue(colab['documento_ofuscado'].startswith('CC ****'))

    def test_10_encolar_alerta_practicas_sena(self):
        """Verifica el encolado de alertas para aprendices SENA próximos a culminar etapa."""
        from datetime import timedelta
        hoy = timezone.now().date()
        self.laboral.practica_lectiva_inicio = hoy - timedelta(days=170)
        self.laboral.practica_lectiva_fin = hoy + timedelta(days=10)
        self.laboral.cargo = 'APRENDIZ SENA ELECTRÓNICA'
        self.laboral.save()

        notif, total, creado = NotificacionCorreoService.encolar_alerta_practicas(
            usuario_operador=self.user_op,
            forzar=True
        )

        self.assertIsNotNone(notif)
        self.assertGreaterEqual(total, 1)
        self.assertTrue(creado)
        self.assertEqual(notif.evento, 'ALERTA_PRACTICAS_SENA')
        aprendiz = notif.contexto['aprendices'][0]
        self.assertEqual(aprendiz['etapa_nombre'], 'Lectiva')
        self.assertEqual(aprendiz['dias_restantes'], 10)
        self.assertTrue(aprendiz['es_advertencia'])

    def test_11_endpoints_enviar_alertas_en_viewset(self):
        """Verifica que las acciones de DRF respondan 200 OK con mensaje estructurado."""
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=self.user_op)

        res_prueba = client.post('/empleados/perfiles/enviar-alertas-periodo-prueba/', {})
        self.assertEqual(res_prueba.status_code, status.HTTP_200_OK)
        self.assertIn('total_notificados', res_prueba.data)

        res_practicas = client.post('/empleados/perfiles/enviar-alertas-practicas/', {})
        self.assertEqual(res_practicas.status_code, status.HTTP_200_OK)
        self.assertIn('total_notificados', res_practicas.data)

