# apps/empleados/services/conciliacion_service.py
import csv
import re
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from apps.empleados.models import (
    EmpleadoSSFF,
    EmpleadoSIIGO,
    EmpleadoLaboral,
    EmpleadoPerfil,
)

User = get_user_model()


def transformar_texto_columnas(texto: str) -> str:
    """Normaliza nombres de encabezados quitando acentos, caracteres especiales y espacios."""
    if not texto:
        return ""
    texto = texto.strip().lower()
    replacements = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u',
        'ñ': 'n', 'Ñ': 'n'
    }
    for orig, rep in replacements.items():
        texto = texto.replace(orig, rep)
    texto = re.sub(r'[^a-z0-9_]', '_', texto)
    texto = re.sub(r'_+', '_', texto)
    return texto.strip('_')


def normalizar_cedula(val) -> str:
    """
    Normaliza el número de cédula:
    - Remueve decimales producidos por Excel (.0, .00)
    - Remueve signos, espacios y sufijos de texto ('1055837370CA' -> '1055837370')
    """
    if val is None:
        return ""
    val_str = str(val).strip()
    val_str = re.sub(r'\.0+$', '', val_str)
    val_str = val_str.replace(',', '').replace('.', '').replace(' ', '').replace('-', '')
    match = re.match(r'^([0-9]+)', val_str)
    if match:
        return match.group(1)
    return re.sub(r'\D', '', val_str)


def detect_scientific_notation(val: str) -> bool:
    """Detecta si un valor de cédula fue deformado por notación científica de Excel (ej: 1.01E+09)."""
    if not val:
        return False
    return 'E+' in str(val).upper() or 'E-' in str(val).upper()


def normalizar_fecha(val_str: str) -> Optional[str]:
    """Intenta parsear formatos comunes de fecha (DD/MM/YYYY, YYYY-MM-DD) y retorna YYYY-MM-DD."""
    if not val_str or val_str.lower() in ('null', 'none', ''):
        return None
    val_str = val_str.strip()
    formatos = [
        '%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y',
        '%d/%m/%y', '%Y/%m/%d', '%d.%m.%Y'
    ]
    for fmt in formatos:
        try:
            dt = datetime.strptime(val_str, fmt)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            pass
    return val_str


def normalizar_salario(val_str: str) -> Optional[str]:
    """Normaliza un salario en formato moneda a string decimal puro (ej: '2.500.000,00' -> '2500000.00')."""
    if not val_str:
        return None
    cleaned = val_str.strip().replace('$', '').replace(' ', '')
    cleaned = cleaned.replace('.', '').replace(',', '.')
    try:
        float_val = float(cleaned)
        return f"{float_val:.2f}"
    except ValueError:
        return val_str.strip()


class ConciliacionService:
    """
    Servicio de conciliación masiva para procesar archivos de nómina (SIIGO)
    y personal (SAP SuccessFactors - SSFF).
    """

    @classmethod
    def _read_csv_lines(cls, file_obj) -> Tuple[List[str], str]:
        """Lee el contenido del archivo CSV y autodetecta el delimitador."""
        raw_bytes = file_obj.read()
        try:
            text = raw_bytes.decode('utf-8-sig')
        except UnicodeDecodeError:
            text = raw_bytes.decode('latin-1')

        lines = [line for line in text.splitlines() if line.strip()]
        if not lines:
            raise ValidationError("El archivo CSV está vacío.")

        header_line = lines[0]
        separadores = [';', '\t', ',', '|']
        best_sep = ','
        max_count = 0
        for sep in separadores:
            cnt = header_line.count(sep)
            if cnt > max_count:
                max_count = cnt
                best_sep = sep

        return lines, best_sep

    @classmethod
    def procesar_archivo_ssff(
        cls,
        file_obj,
        user=None,
        user_username: str = ""
    ) -> Dict[str, Any]:
        """
        Procesa el reporte CSV de SAP SuccessFactors:
        - Valida columna Cédula
        - Relaciona por FK con EmpleadoPerfil si existe en el sistema
        - Detecta cédulas en notación científica de Excel
        - Sincroniza automáticamente codigo_sap en EmpleadoLaboral
        - Inserta o actualiza en EmpleadoSSFF (con created_at, updated_at, actualizado_por)
        - Marca DELETE a los colaboradores que ya no vienen en el archivo
        """
        user_obj = user if (user and isinstance(user, User)) else None

        lines, separador = cls._read_csv_lines(file_obj)
        reader = csv.reader(lines, delimiter=separador)
        try:
            raw_headers = next(reader)
        except StopIteration:
            raise ValidationError("El archivo no contiene encabezados.")

        valid_columns = []
        for h in raw_headers:
            col = transformar_texto_columnas(h)
            if col in ('status', 'estado_ssff'):
                col = 'estado'
            elif col in ('cdula', 'cedula_de_ciudadania'):
                col = 'cedula'
            elif col in ('userid', 'user_id', 'id_usuario'):
                col = 'userid'
            elif col in ('gv_zona', 'gv__zona'):
                col = 'gv_zona'
            valid_columns.append(col)

        if 'cedula' not in valid_columns:
            raise ValidationError(
                'No se encontró la columna "Cédula" en el archivo importado. Verifique el encabezado y formato del archivo.'
            )

        cedula_idx = valid_columns.index('cedula')

        # Cargar registros existentes en EmpleadoSSFF
        existing_ssff = {item.cedula: item for item in EmpleadoSSFF.objects.all()}

        # Cargar mapa de perfiles para vincular la clave foránea empleado_id y actualizar codigo_sap
        perfiles_by_doc = {}
        laboral_by_doc = {}
        for perfil in EmpleadoPerfil.objects.select_related('laboral').all():
            doc = normalizar_cedula(perfil.numero_documento)
            if doc:
                perfiles_by_doc[doc] = perfil
                if hasattr(perfil, 'laboral') and perfil.laboral:
                    laboral_by_doc[doc] = perfil.laboral

        total_registros = 0
        cnt_insertados = 0
        cnt_actualizados = 0
        cnt_desactivados = 0
        cnt_sap_actualizados = 0
        cedulas_con_error = []
        cedulas_procesadas = set()

        to_create = []
        to_update = []
        laborales_to_update = []
        now = timezone.now()

        for row_idx, row in enumerate(reader, start=2):
            if not row:
                continue
            total_registros += 1

            if cedula_idx >= len(row):
                continue

            cedula_raw = row[cedula_idx].strip()
            if not cedula_raw:
                continue

            # Validar notación científica de Excel
            if detect_scientific_notation(cedula_raw):
                cedulas_con_error.append({
                    'cedula': cedula_raw,
                    'fila': row_idx,
                    'error': 'Notación científica detectada en Excel'
                })
                continue

            cedula_clean = normalizar_cedula(cedula_raw)
            if not cedula_clean:
                continue

            cedulas_procesadas.add(cedula_clean)

            # Construir diccionario de datos
            row_data = {}
            for col_idx, col_name in enumerate(valid_columns):
                if col_idx < len(row):
                    val = row[col_idx].strip()
                    if col_name in ('hire_date', 'last_review_date', 'company_exit_date'):
                        val = normalizar_fecha(val)
                    row_data[col_name] = val

            # Determinar estado
            estado_val = 'INACTIVO'
            raw_estado = str(row_data.get('estado', '')).lower()
            if raw_estado in ('active', 'activo'):
                estado_val = 'ACTIVO'

            # Extraer y normalizar nombres, apellidos y userid (código SAP)
            nombres_val = str(row_data.get('nombres', '') or row_data.get('first_name', '')).strip() or None
            apellidos_val = str(row_data.get('apellidos', '') or row_data.get('last_name', '')).strip() or None

            userid_val = row_data.get('userid', '')
            if userid_val:
                userid_val = normalizar_cedula(userid_val)
                row_data['userid'] = userid_val

            # Relación directa con el colaborador registrado
            perfil_asociado = perfiles_by_doc.get(cedula_clean)

            # Sincronizar codigo_sap en EmpleadoLaboral si aplica
            if userid_val and not detect_scientific_notation(userid_val) and userid_val.lower() not in ('null', 'n/a', '#n/a', '0'):
                if cedula_clean in laboral_by_doc:
                    lab = laboral_by_doc[cedula_clean]
                    current_sap = str(lab.codigo_sap or '').strip()
                    no_tiene_sap = current_sap in ('', 'None', '#N/A', 'N/A', '0')
                    no_coincide = current_sap != userid_val
                    if no_tiene_sap or no_coincide:
                        lab.codigo_sap = userid_val
                        laborales_to_update.append(lab)
                        cnt_sap_actualizados += 1

            # Preparar registro SSFF
            if cedula_clean in existing_ssff:
                obj = existing_ssff[cedula_clean]
                obj.empleado = perfil_asociado
                if nombres_val:
                    obj.nombres = nombres_val
                if apellidos_val:
                    obj.apellidos = apellidos_val
                if userid_val:
                    obj.userid = userid_val
                obj.estado = estado_val

                current_datos = obj.datos or {}
                if isinstance(current_datos, dict):
                    current_datos.update(row_data)
                    obj.datos = current_datos
                else:
                    obj.datos = row_data

                if user_obj:
                    obj.actualizado_por = user_obj
                obj.updated_at = now
                to_update.append(obj)
                cnt_actualizados += 1
            else:
                new_obj = EmpleadoSSFF(
                    empleado=perfil_asociado,
                    cedula=cedula_clean,
                    nombres=nombres_val,
                    apellidos=apellidos_val,
                    userid=userid_val or None,
                    estado=estado_val,
                    datos=row_data,
                    actualizado_por=user_obj,
                )
                to_create.append(new_obj)
                cnt_insertados += 1

        # Cédulas en la base previa no presentes en el archivo -> estado = 'DELETE'
        to_delete = []
        for ced, obj in existing_ssff.items():
            if ced not in cedulas_procesadas and obj.estado != 'DELETE':
                obj.estado = 'DELETE'
                if user_obj:
                    obj.actualizado_por = user_obj
                obj.updated_at = now
                to_delete.append(obj)
                cnt_desactivados += 1

        # Ejecución transaccional
        with transaction.atomic():
            if to_create:
                EmpleadoSSFF.objects.bulk_create(to_create, batch_size=500)
            if to_update:
                EmpleadoSSFF.objects.bulk_update(
                    to_update,
                    ['empleado', 'nombres', 'apellidos', 'userid', 'estado', 'datos', 'actualizado_por', 'updated_at'],
                    batch_size=500
                )
            if to_delete:
                EmpleadoSSFF.objects.bulk_update(
                    to_delete,
                    ['estado', 'actualizado_por', 'updated_at'],
                    batch_size=500
                )
            if laborales_to_update:
                EmpleadoLaboral.objects.bulk_update(laborales_to_update, ['codigo_sap'], batch_size=500)

        return {
            'success': True,
            'total_registros': total_registros,
            'cnt_insertados': cnt_insertados,
            'cnt_actualizados': cnt_actualizados,
            'cnt_desactivados': cnt_desactivados,
            'cnt_sap_actualizados': cnt_sap_actualizados,
            'cedulas_con_error': cedulas_con_error,
        }

    @classmethod
    def procesar_archivo_siigo(
        cls,
        file_obj,
        user=None,
        user_username: str = ""
    ) -> Dict[str, Any]:
        """
        Procesa el reporte CSV de SIIGO:
        - Valida columna NIT/Cédula
        - Relaciona por FK con EmpleadoPerfil si existe en el sistema
        - Extrae y actualiza salario y centro de costos
        - Inserta o actualiza en EmpleadoSIIGO (con created_at, updated_at, actualizado_por)
        - Inactiva (INACTIVO) aquellos colaboradores que ya no vienen en el archivo
        """
        user_obj = user if (user and isinstance(user, User)) else None

        lines, separador = cls._read_csv_lines(file_obj)
        reader = csv.reader(lines, delimiter=separador)
        try:
            raw_headers = next(reader)
        except StopIteration:
            raise ValidationError("El archivo no contiene encabezados.")

        valid_columns = []
        transformed_raw = [transformar_texto_columnas(h) for h in raw_headers]

        for idx, title in enumerate(transformed_raw):
            column_name = title
            titulo_siguiente = transformed_raw[idx + 1] if idx + 1 < len(transformed_raw) else None
            titulo_anterior = transformed_raw[idx - 1] if idx - 1 >= 0 else None

            if column_name in ('nit', 'identificacion'):
                column_name = 'cedula'
            elif column_name == 'nombre' and titulo_anterior in ('nit', 'cedula', 'identificacion'):
                column_name = 'nombre_empleado'
            elif column_name == 'ciudad':
                column_name = 'codigo_ciudad'
            elif column_name == 'nombre' and titulo_anterior in ('ciudad', 'codigo_ciudad'):
                column_name = 'nombre_ciudad'
            elif column_name == 'codigo':
                column_name = 'codigo_cargo'
            elif column_name == '' and titulo_siguiente == 'pension':
                column_name = 'codigo_pension'
            elif column_name == '' and titulo_siguiente == 'salud':
                column_name = 'codigo_salud'
            elif column_name == '' and titulo_siguiente == 'cesantias':
                column_name = 'codigo_cesantias'
            elif column_name == '' and titulo_siguiente == 'caja':
                column_name = 'codigo_caja'

            valid_columns.append(column_name)

        if 'cedula' not in valid_columns:
            raise ValidationError(
                'No se encontró la columna "NIT" o "Cédula" en el archivo importado de SIIGO.'
            )

        cedula_idx = valid_columns.index('cedula')

        existing_siigo = {item.cedula: item for item in EmpleadoSIIGO.objects.all()}

        # Cargar mapa de perfiles para vincular la clave foránea empleado_id
        perfiles_by_doc = {}
        for perfil in EmpleadoPerfil.objects.all():
            doc = normalizar_cedula(perfil.numero_documento)
            if doc:
                perfiles_by_doc[doc] = perfil

        total_registros = 0
        cnt_insertados = 0
        cnt_actualizados = 0
        cnt_desactivados = 0
        cedulas_procesadas = set()

        to_create = []
        to_update = []
        now = timezone.now()

        for row_idx, row in enumerate(reader, start=2):
            if not row:
                continue
            total_registros += 1

            if cedula_idx >= len(row):
                continue

            cedula_raw = row[cedula_idx].strip()
            cedula_clean = normalizar_cedula(cedula_raw)
            if not cedula_clean:
                continue

            cedulas_procesadas.add(cedula_clean)

            row_data = {}
            salario_val = None
            centro_costo_val = None
            nombre_emp_val = None

            for col_idx, col_name in enumerate(valid_columns):
                if col_idx < len(row):
                    val = row[col_idx].strip()
                    if col_name == 'nombre_empleado':
                        nombre_emp_val = val
                    elif col_name in ('sueldo', 'salario'):
                        salario_val = normalizar_salario(val)
                    elif col_name in ('cc', 'centro_costo', 'centro_de_costo'):
                        centro_costo_val = val

                    if col_name.startswith('f_'):
                        val = normalizar_fecha(val)
                    row_data[col_name] = val

            perfil_asociado = perfiles_by_doc.get(cedula_clean)

            if cedula_clean in existing_siigo:
                obj = existing_siigo[cedula_clean]
                obj.empleado = perfil_asociado
                if nombre_emp_val:
                    obj.nombre_empleado = nombre_emp_val
                obj.estado = 'ACTIVO'
                obj.salario = salario_val or obj.salario
                obj.centro_costo = centro_costo_val or obj.centro_costo

                current_datos = obj.datos or {}
                if isinstance(current_datos, dict):
                    current_datos.update(row_data)
                    obj.datos = current_datos
                else:
                    obj.datos = row_data

                if user_obj:
                    obj.actualizado_por = user_obj
                obj.updated_at = now
                to_update.append(obj)
                cnt_actualizados += 1
            else:
                new_obj = EmpleadoSIIGO(
                    empleado=perfil_asociado,
                    cedula=cedula_clean,
                    nombre_empleado=nombre_emp_val,
                    estado='ACTIVO',
                    centro_costo=centro_costo_val,
                    salario=salario_val,
                    datos=row_data,
                    actualizado_por=user_obj,
                )
                to_create.append(new_obj)
                cnt_insertados += 1

        # Cédulas ausentes en el archivo -> estado = 'INACTIVO'
        to_inactivate = []
        for ced, obj in existing_siigo.items():
            if ced not in cedulas_procesadas and obj.estado != 'INACTIVO':
                obj.estado = 'INACTIVO'
                if user_obj:
                    obj.actualizado_por = user_obj
                obj.updated_at = now
                to_inactivate.append(obj)
                cnt_desactivados += 1

        with transaction.atomic():
            if to_create:
                EmpleadoSIIGO.objects.bulk_create(to_create, batch_size=500)
            if to_update:
                EmpleadoSIIGO.objects.bulk_update(
                    to_update,
                    ['empleado', 'nombre_empleado', 'estado', 'centro_costo', 'salario', 'datos', 'actualizado_por', 'updated_at'],
                    batch_size=500
                )
            if to_inactivate:
                EmpleadoSIIGO.objects.bulk_update(
                    to_inactivate,
                    ['estado', 'actualizado_por', 'updated_at'],
                    batch_size=500
                )

        return {
            'success': True,
            'total_registros': total_registros,
            'cnt_insertados': cnt_insertados,
            'cnt_actualizados': cnt_actualizados,
            'cnt_desactivados': cnt_desactivados,
        }
