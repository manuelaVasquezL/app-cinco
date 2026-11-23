"""
Servicio para la generación del Informe de Infraestructura y Capacidad.
Implementado 100% sobre el modelo relacional normalizado de Django (default DB):
1. Capacidad por Área, Carpeta y Colaboradores (matriz interactiva de 3 paneles).
2. Período de Prueba (primeros 2 meses / 60 días).
3. Alerta de Contratos (Prácticas y contratos por vencer).
4. Rotación por Área (comparativa año anterior vs año actual mes a mes).
"""
import calendar
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict
from django.db.models import Q
from apps.empleados.models import EmpleadoPerfil, EmpleadoLaboral


class InformeCapacidadService:
    """
    Consolida las 4 secciones del Informe de Infraestructura usando el ORM nativo
    sobre EmpleadoPerfil y EmpleadoLaboral en la base de datos principal.
    """

    @classmethod
    def generar_informe(cls, anio: Optional[int] = None) -> Dict[str, Any]:
        hoy = date.today()
        anio_actual = int(anio) if anio and int(anio) >= 2000 else hoy.year
        anio_anterior = anio_actual - 1

        # 1. Cargar empleados activos y construir matriz de Capacidad
        capacidad_data = cls._obtener_capacidad()

        # 2. Cargar colaboradores en Período de Prueba
        periodo_prueba_data = cls._obtener_periodo_prueba(hoy)

        # 3. Cargar alertas de contratos (prácticas / contratos estipulados)
        alerta_contratos_data = cls._obtener_alerta_contratos(hoy)

        # 4. Calcular Rotación por Área (mes a mes)
        rotacion_data = cls._obtener_rotacion(anio_actual, anio_anterior)

        return {
            "anio": anio_actual,
            "anio_anterior": anio_anterior,
            "capacidad": capacidad_data,
            "periodo_prueba": periodo_prueba_data,
            "alerta_contratos": alerta_contratos_data,
            "rotacion": rotacion_data,
        }

    @classmethod
    def _obtener_capacidad(cls) -> Dict[str, Any]:
        """
        Agrupa colaboradores activos por Área -> Carpeta -> Tipo de Cargo.
        Tipos de cargo legacy:
        - 'tecnico': técnico
        - 'auxiliar': auxiliar
        - 'supervisor': supervisor
        - 'otros': cualquier otro cargo
        """
        empleados_activos = cls._consultar_empleados_activos()

        areas_map: Dict[str, Dict[str, Any]] = {}
        general_totales = {
            "tecnicos": 0,
            "auxiliares": 0,
            "supervisores": 0,
            "otros": 0,
            "total": 0,
        }

        for emp in empleados_activos:
            area_name = (emp.get("area") or "SIN ÁREA").strip().upper()
            carpeta_name = (emp.get("carpeta") or "SIN CARPETA").strip().upper()
            cargo_raw = (emp.get("cargo") or "").strip().lower()

            # Clasificación de cargo legacy
            if cargo_raw == "supervisor" or "supervisor" in cargo_raw:
                tipo = "supervisores"
            elif cargo_raw == "auxiliar" or ("auxiliar" in cargo_raw and "tecnico" not in cargo_raw):
                tipo = "auxiliares"
            elif "tecnico" in cargo_raw or "técnico" in cargo_raw:
                tipo = "tecnicos"
            else:
                tipo = "otros"

            if area_name not in areas_map:
                areas_map[area_name] = {
                    "name": area_name,
                    "tecnicos": 0,
                    "auxiliares": 0,
                    "supervisores": 0,
                    "otros": 0,
                    "total": 0,
                    "carpetas_dict": {},
                    "filterByCargo": set(),
                }

            area_obj = areas_map[area_name]
            area_obj[tipo] += 1
            area_obj["total"] += 1
            area_obj["filterByCargo"].add((emp.get("cargo") or "Sin cargo").strip().upper())

            general_totales[tipo] += 1
            general_totales["total"] += 1

            # Sub-agrupación por Carpeta
            carp_dict = area_obj["carpetas_dict"]
            if carpeta_name not in carp_dict:
                carp_dict[carpeta_name] = {
                    "name": carpeta_name,
                    "tecnicos": 0,
                    "auxiliares": 0,
                    "supervisores": 0,
                    "otros": 0,
                    "total": 0,
                    "empleados": [],
                }

            carp_obj = carp_dict[carpeta_name]
            carp_obj[tipo] += 1
            carp_obj["total"] += 1
            carp_obj["empleados"].append({
                "id": emp.get("id"),
                "cedula": emp.get("cedula"),
                "nombre_completo": f"{emp.get('nombre', '')} {emp.get('apellido', '')}".strip(),
                "cargo": emp.get("cargo") or "Sin cargo",
                "estado": emp.get("estado", "ACTIVO"),
                "foto": emp.get("foto"),
                "carpeta": carpeta_name,
                "area": area_name,
            })

        # Estructurar resultado ordenado
        areas_list = []
        for area_name in sorted(areas_map.keys()):
            area_obj = areas_map[area_name]
            carpetas_list = []
            for c_name in sorted(area_obj["carpetas_dict"].keys()):
                carpetas_list.append(area_obj["carpetas_dict"][c_name])

            areas_list.append({
                "name": area_name,
                "tecnicos": area_obj["tecnicos"],
                "auxiliares": area_obj["auxiliares"],
                "supervisores": area_obj["supervisores"],
                "otros": area_obj["otros"],
                "total": area_obj["total"],
                "filterByCargo": sorted(list(area_obj["filterByCargo"])),
                "carpetas": carpetas_list,
            })

        return {
            "areas": areas_list,
            "general": general_totales,
        }

    @classmethod
    def _obtener_periodo_prueba(cls, hoy: date) -> List[Dict[str, Any]]:
        """
        Consulta colaboradores activos en período de prueba (ingresados en los últimos 4 meses / 120 días).
        Calcula días restantes hasta los 2 meses (60 días) de prueba mediante EmpleadoLaboral.
        """
        hace_4_meses = hoy - timedelta(days=120)
        items = []

        qs = (
            EmpleadoPerfil.objects.filter(
                estado="ACTIVO",
                laboral__fecha_ingreso__isnull=False,
                laboral__fecha_ingreso__gte=hace_4_meses,
            )
            .select_related("laboral")
            .order_by("laboral__fecha_ingreso")
        )

        for p in qs:
            lab = getattr(p, "laboral", None)
            if not lab or not lab.fecha_ingreso:
                continue

            # Cálculo de 2 meses calendario desde la fecha de ingreso
            year = lab.fecha_ingreso.year + (lab.fecha_ingreso.month + 2 - 1) // 12
            month = (lab.fecha_ingreso.month + 2 - 1) % 12 + 1
            max_day = calendar.monthrange(year, month)[1]
            day = min(lab.fecha_ingreso.day, max_day)
            fin_prueba = date(year, month, day)
            dias = (fin_prueba - hoy).days

            items.append({
                "id": p.id,
                "cedula": p.numero_documento,
                "nombre_completo": f"{p.nombres} {p.apellidos}".strip(),
                "estado": p.estado,
                "movil": getattr(lab, "movil", "") or "",
                "cargo": lab.cargo or "Sin cargo",
                "area": lab.area or "Sin área",
                "carpeta": lab.carpeta or "Sin carpeta",
                "fecha_ingreso": lab.fecha_ingreso.isoformat(),
                "dias_restantes": dias,
            })

        items.sort(key=lambda x: x["dias_restantes"])
        return items

    @classmethod
    def _obtener_alerta_contratos(cls, hoy: date) -> List[Dict[str, Any]]:
        """
        Consulta colaboradores activos con contratos próximos a vencer o vencidos
        desde el modelo normalizado EmpleadoLaboral.
        """
        limite = hoy + timedelta(days=5)
        items = []

        qs = (
            EmpleadoPerfil.objects.filter(estado="ACTIVO")
            .select_related("laboral")
        )

        for p in qs:
            lab = getattr(p, "laboral", None)
            if not lab:
                continue

            fecha_fin = getattr(lab, "fecha_fin_contrato", None)
            if not fecha_fin:
                continue

            st = None
            if fecha_fin < hoy:
                st = "vencido"
            elif fecha_fin <= limite:
                st = "proximo"

            if st:
                fecha_ini = getattr(lab, "fecha_inicio_contrato", None) or lab.fecha_ingreso
                tipo_c = getattr(lab, "duracion_contrato", None) or getattr(lab, "tipo_contrato", None) or "Sin tipo"
                items.append({
                    "id": p.id,
                    "cedula": p.numero_documento,
                    "nombre_completo": f"{p.nombres} {p.apellidos}".strip(),
                    "movil": getattr(lab, "movil", "") or "",
                    "cargo": lab.cargo or "Sin cargo",
                    "area": lab.area or "Sin área",
                    "carpeta": lab.carpeta or "Sin carpeta",
                    "tipo": "contrato",
                    "tipo_contrato": tipo_c,
                    "estado": st,
                    "fecha_inicio": fecha_ini.isoformat() if fecha_ini else "",
                    "fecha_fin": fecha_fin.isoformat(),
                    "dias_restantes": (fecha_fin - hoy).days,
                })

        items.sort(key=lambda x: x["dias_restantes"])
        return items

    @classmethod
    def _obtener_rotacion(cls, anio_actual: int, anio_anterior: int) -> Dict[str, Any]:
        """
        Calcula la rotación mensual por Área (Ingresos y Egresos) a partir de EmpleadoLaboral.
        Compara año anterior vs año actual mes a mes (12 meses).
        """
        rot_map: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "anterior": {"ingresos": 0, "egresos": 0},
            "actual": {"ingresos": 0, "egresos": 0},
            "meses": [{"mes": m, "nombre": calendar.month_name[m], "ingresos": 0, "egresos": 0} for m in range(1, 13)],
        })

        all_years = set([anio_actual, anio_anterior])

        totales = {
            "anterior": {"ingresos": 0, "egresos": 0},
            "actual": {"ingresos": 0, "egresos": 0},
            "meses": [{"mes": m, "nombre": calendar.month_name[m], "ingresos": 0, "egresos": 0} for m in range(1, 13)],
        }

        # Consultar todos los registros laborales con fecha de ingreso o egreso registrada
        qs = (
            EmpleadoLaboral.objects.filter(
                Q(fecha_ingreso__isnull=False) | Q(fecha_egreso__isnull=False)
            )
            .values("area", "fecha_ingreso", "fecha_egreso")
        )

        for row in qs:
            area = (row.get("area") or "SIN ÁREA").strip().upper()
            f_ing = row.get("fecha_ingreso")
            f_egr = row.get("fecha_egreso")

            if f_ing and hasattr(f_ing, "year"):
                y, m = f_ing.year, f_ing.month
                all_years.add(y)
                if y == anio_anterior:
                    rot_map[area]["anterior"]["ingresos"] += 1
                    totales["anterior"]["ingresos"] += 1
                elif y == anio_actual and 1 <= m <= 12:
                    rot_map[area]["actual"]["ingresos"] += 1
                    rot_map[area]["meses"][m - 1]["ingresos"] += 1
                    totales["actual"]["ingresos"] += 1
                    totales["meses"][m - 1]["ingresos"] += 1

            if f_egr and hasattr(f_egr, "year"):
                y, m = f_egr.year, f_egr.month
                all_years.add(y)
                if y == anio_anterior:
                    rot_map[area]["anterior"]["egresos"] += 1
                    totales["anterior"]["egresos"] += 1
                elif y == anio_actual and 1 <= m <= 12:
                    rot_map[area]["actual"]["egresos"] += 1
                    rot_map[area]["meses"][m - 1]["egresos"] += 1
                    totales["actual"]["egresos"] += 1
                    totales["meses"][m - 1]["egresos"] += 1

        areas_list = []
        for a_name in sorted(rot_map.keys()):
            data = rot_map[a_name]
            areas_list.append({
                "name": a_name,
                "anterior": data["anterior"],
                "actual": data["actual"],
                "meses": data["meses"],
            })

        # Años ordenados descendente
        years_sorted = sorted([y for y in all_years if 2015 <= y <= date.today().year + 1], reverse=True)
        if not years_sorted:
            years_sorted = [anio_actual, anio_anterior]

        return {
            "years": years_sorted,
            "year_actual": anio_actual,
            "year_anterior": anio_anterior,
            "areas": areas_list,
            "totales": totales,
        }

    @classmethod
    def _consultar_empleados_activos(cls) -> List[Dict[str, Any]]:
        """
        Consulta colaboradores activos desde EmpleadoPerfil y EmpleadoLaboral en la base de datos principal.
        """
        qs = (
            EmpleadoPerfil.objects.filter(estado="ACTIVO")
            .select_related("laboral")
            .order_by("apellidos", "nombres")
        )
        items = []
        for p in qs:
            lab = getattr(p, "laboral", None)
            items.append({
                "id": p.id,
                "cedula": p.numero_documento,
                "nombre": p.nombres,
                "apellido": p.apellidos,
                "cargo": getattr(lab, "cargo", "") or "Sin cargo",
                "area": getattr(lab, "area", "") or "SIN ÁREA",
                "carpeta": getattr(lab, "carpeta", "") or "SIN CARPETA",
                "estado": p.estado,
                "foto": p.foto.url if hasattr(p, "foto") and p.foto else None,
            })
        return items
