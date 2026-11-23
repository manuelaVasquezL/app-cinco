// src/modules/infraestructura/personal/components/TablaInforme.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Activity,
  AlertTriangle,
  RefreshCw,
  Download,
  Filter,
  Clock,
  Briefcase,
  Layers,
  Building2,
  CheckCircle2,
  FolderKanban,
  Search,
  ArrowUpRight,
  BarChart3,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import {
  InformeInfraestructuraResponse,
  AreaCapacidad,
  CarpetaCapacidad,
  EmpleadoCapacidadItem,
  PeriodoPruebaItem,
  AlertaContratoItem,
  AreaRotacionItem,
} from "@/types/empleado";
import { personalService } from "../services/personalService";
import { exportToCsv, CsvColumn } from "@/utils/csv";

interface TablaInformeProps {
  onSelectEmpleado?: (id: number) => void;
}

export const TablaInforme: React.FC<TablaInformeProps> = ({
  onSelectEmpleado,
}) => {
  const [data, setData] = useState<InformeInfraestructuraResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Año seleccionado para la rotación
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Estado de interactividad para la Tricelda de Capacidad:
  // 1. Área seleccionada (por defecto la primera disponible)
  const [selectedAreaName, setSelectedAreaName] = useState<string>("");
  // 2. Carpeta seleccionada dentro del área ('TODAS' por defecto)
  const [selectedCarpetaName, setSelectedCarpetaName] = useState<string>("TODAS");
  // 3. Filtro por tipo de cargo en la celda (tecnicos, auxiliares, supervisores, otros, todos)
  const [selectedTipoCargo, setSelectedTipoCargo] = useState<string>("todos");
  // 4. Búsqueda rápida de colaboradores dentro del Panel 3
  const [searchEmpleadoQuery, setSearchEmpleadoQuery] = useState<string>("");
  // 5. Filtro multi-check de cargos específicos
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);
  const [selectedCargosFilter, setSelectedCargosFilter] = useState<string[]>([]);

  // Búsqueda en tablas de alertas
  const [searchPruebaQuery, setSearchPruebaQuery] = useState<string>("");
  const [searchContratosQuery, setSearchContratosQuery] = useState<string>("");

  const loadData = useCallback(async (yearToLoad?: number) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await personalService.getInformeCapacidad(yearToLoad || selectedYear);
      setData(res);

      // Si aún no hay área seleccionada o la seleccionada no existe en la respuesta, tomar la primera
      if (res.capacidad?.areas?.length > 0) {
        setSelectedAreaName((prev) => {
          const exists = res.capacidad.areas.some((a) => a.name === prev);
          return exists && prev ? prev : res.capacidad.areas[0].name;
        });
      }
    } catch (err: any) {
      console.error("Error al cargar informe de infraestructura:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "No se pudo cargar el informe de infraestructura y capacidad."
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadData(selectedYear);
  }, [loadData, selectedYear]);

  // Área activa seleccionada
  const activeArea = useMemo<AreaCapacidad | null>(() => {
    if (!data?.capacidad?.areas) return null;
    return (
      data.capacidad.areas.find((a) => a.name === selectedAreaName) ||
      data.capacidad.areas[0] ||
      null
    );
  }, [data, selectedAreaName]);

  // Al cambiar de área, reiniciar filtros de carpeta y cargos
  const handleSelectArea = (areaName: string) => {
    setSelectedAreaName(areaName);
    setSelectedCarpetaName("TODAS");
    setSelectedTipoCargo("todos");
    setSelectedCargosFilter([]);
    setSearchEmpleadoQuery("");
    setIsFilterDropdownOpen(false);
  };

  // Filtrado de empleados en el Panel 3
  const empleadosFiltrados = useMemo<EmpleadoCapacidadItem[]>(() => {
    if (!activeArea) return [];

    let list: EmpleadoCapacidadItem[] = [];

    // Si seleccionó una carpeta específica
    if (selectedCarpetaName !== "TODAS") {
      const carpeta = activeArea.carpetas.find((c) => c.name === selectedCarpetaName);
      if (carpeta) {
        list = [...carpeta.empleados];
      }
    } else {
      // Todas las carpetas del área
      activeArea.carpetas.forEach((c) => {
        list.push(...c.empleados);
      });
    }

    // Filtrar por tipo de cargo si dio clic en una columna específica (Téc, Aux, Sup, Otros)
    if (selectedTipoCargo !== "todos") {
      list = list.filter((emp) => {
        const c = (emp.cargo || "").toLowerCase();
        if (selectedTipoCargo === "tecnicos") {
          return c.includes("tecnico") || c.includes("técnico");
        }
        if (selectedTipoCargo === "auxiliares") {
          return c.includes("auxiliar") && !c.includes("tecnico");
        }
        if (selectedTipoCargo === "supervisores") {
          return c.includes("supervisor");
        }
        if (selectedTipoCargo === "otros") {
          return (
            !c.includes("tecnico") &&
            !c.includes("técnico") &&
            !c.includes("auxiliar") &&
            !c.includes("supervisor")
          );
        }
        return true;
      });
    }

    // Filtro por multi-checkbox de cargos específicos
    if (selectedCargosFilter.length > 0) {
      list = list.filter((emp) =>
        selectedCargosFilter.includes((emp.cargo || "").trim().toUpperCase())
      );
    }

    // Búsqueda rápida por nombre o cédula
    if (searchEmpleadoQuery.trim()) {
      const q = searchEmpleadoQuery.toLowerCase().trim();
      list = list.filter(
        (emp) =>
          emp.nombre_completo.toLowerCase().includes(q) ||
          emp.cedula.toLowerCase().includes(q) ||
          (emp.cargo && emp.cargo.toLowerCase().includes(q))
      );
    }

    return list;
  }, [
    activeArea,
    selectedCarpetaName,
    selectedTipoCargo,
    selectedCargosFilter,
    searchEmpleadoQuery,
  ]);

  const toggleCargoCheckbox = (cargoName: string) => {
    setSelectedCargosFilter((prev) =>
      prev.includes(cargoName)
        ? prev.filter((c) => c !== cargoName)
        : [...prev, cargoName]
    );
  };

  // Filtrado de Periodo de Prueba
  const periodoPruebaFiltrado = useMemo<PeriodoPruebaItem[]>(() => {
    if (!data?.periodo_prueba) return [];
    if (!searchPruebaQuery.trim()) return data.periodo_prueba;
    const q = searchPruebaQuery.toLowerCase().trim();
    return data.periodo_prueba.filter(
      (p) =>
        p.nombre_completo.toLowerCase().includes(q) ||
        p.cedula.toLowerCase().includes(q) ||
        p.cargo.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q)
    );
  }, [data?.periodo_prueba, searchPruebaQuery]);

  // Filtrado de Alerta Contratos
  const alertaContratosFiltrada = useMemo<AlertaContratoItem[]>(() => {
    if (!data?.alerta_contratos) return [];
    if (!searchContratosQuery.trim()) return data.alerta_contratos;
    const q = searchContratosQuery.toLowerCase().trim();
    return data.alerta_contratos.filter(
      (c) =>
        c.nombre_completo.toLowerCase().includes(q) ||
        c.cedula.toLowerCase().includes(q) ||
        c.cargo.toLowerCase().includes(q) ||
        c.area.toLowerCase().includes(q) ||
        c.tipo_contrato.toLowerCase().includes(q)
    );
  }, [data?.alerta_contratos, searchContratosQuery]);

  // Exportar Rotación a CSV
  const handleExportRotacionCsv = () => {
    if (!data?.rotacion) return;

    const rows = data.rotacion.areas.map((a) => {
      const rowObj: any = {
        area: a.name,
        ingresos_anterior: a.anterior.ingresos,
        egresos_anterior: a.anterior.egresos,
        ingresos_actual: a.actual.ingresos,
        egresos_actual: a.actual.egresos,
      };
      a.meses.forEach((m) => {
        rowObj[`${m.nombre}_ingresos`] = m.ingresos;
        rowObj[`${m.nombre}_egresos`] = m.egresos;
      });
      return rowObj;
    });

    const columns: CsvColumn<any>[] = [
      { header: "Área", accessor: (r) => r.area },
      { header: `${data.rotacion.year_anterior} Ingresos`, accessor: (r) => r.ingresos_anterior },
      { header: `${data.rotacion.year_anterior} Egresos`, accessor: (r) => r.egresos_anterior },
      { header: `${data.rotacion.year_actual} Total Ingresos`, accessor: (r) => r.ingresos_actual },
      { header: `${data.rotacion.year_actual} Total Egresos`, accessor: (r) => r.egresos_actual },
    ];

    data.rotacion.totales.meses.forEach((m) => {
      columns.push({ header: `${m.nombre} Ingresos`, accessor: (r) => r[`${m.nombre}_ingresos`] });
      columns.push({ header: `${m.nombre} Egresos`, accessor: (r) => r[`${m.nombre}_egresos`] });
    });

    exportToCsv(rows, {
      fileName: `rotacion_por_area_${data.rotacion.year_actual}.csv`,
      columns,
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Banner (Consistente con TablaSIIGO y TablaSSFF) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Informe de Capacidad y Rotación
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Matriz de capacidad por área y carpeta, control de período de prueba, alertas contractuales y rotación histórica.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadData(selectedYear)}
            disabled={isLoading}
            className="flex items-center gap-2"
            startIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />}
          >
            Actualizar
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportRotacionCsv}
            disabled={!data || isLoading}
            className="flex items-center gap-2"
            startIcon={<Download className="w-3.5 h-3.5" />}
          >
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SECCIÓN 1: TRICELDA INTERACTIVA DE CAPACIDAD */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand-600" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Capacidad Operativa por Área, Carpeta y Colaboradores
            </h3>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Haz clic en un área o carpeta para explorar la dotación en tiempo real
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Panel 1: Capacidad por Área (4 cols) */}
          <div className="lg:col-span-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-sm overflow-hidden flex flex-col h-[520px]">
            {/* Header del Panel */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Áreas de Operación
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {data?.capacidad?.areas?.length || 0}
              </span>
            </div>

            {/* Tabla con scroll */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-gray-900 text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Área</th>
                    <th className="px-2 py-2.5 text-center">Téc</th>
                    <th className="px-2 py-2.5 text-center">Aux</th>
                    <th className="px-2 py-2.5 text-center">Sup</th>
                    <th className="px-2 py-2.5 text-center">Otros</th>
                    <th className="px-2.5 py-2.5 text-center font-bold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  {data?.capacidad?.areas?.map((area, idx) => {
                    const isSelected = area.name === selectedAreaName;
                    return (
                      <tr
                        key={idx}
                        onClick={() => handleSelectArea(area.name)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-gray-100/90 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold"
                            : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <span className="truncate max-w-[150px] block" title={area.name}>
                            {area.name}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono text-[11px] text-gray-600 dark:text-gray-400">
                          {area.tecnicos || "-"}
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono text-[11px] text-gray-600 dark:text-gray-400">
                          {area.auxiliares || "-"}
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono text-[11px] text-gray-600 dark:text-gray-400">
                          {area.supervisores || "-"}
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono text-[11px] text-gray-600 dark:text-gray-400">
                          {area.otros || "-"}
                        </td>
                        <td className="px-2.5 py-2.5 text-center font-mono text-xs font-bold">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded ${
                              isSelected
                                ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                            }`}
                          >
                            {area.total}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer fijo con total */}
            {data?.capacidad?.general && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 shrink-0">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-900 dark:text-white">
                  <span className="uppercase text-[11px] tracking-wider text-gray-500 dark:text-gray-400">
                    Capacidad Total
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500 font-mono">
                      {data.capacidad.general.tecnicos}T / {data.capacidad.general.auxiliares}A / {data.capacidad.general.supervisores}S
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-brand-600 text-white font-mono font-bold text-xs">
                      {data.capacidad.general.total}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Panel 2: Capacidad por Carpeta (Área Seleccionada) (4 cols) */}
          <div className="lg:col-span-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-sm overflow-hidden flex flex-col h-[520px]">
            {/* Header del Panel */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FolderKanban className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider truncate">
                  Carpetas: <span className="font-bold text-gray-900 dark:text-white">{selectedAreaName || "General"}</span>
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 shrink-0">
                {activeArea?.carpetas?.length || 0}
              </span>
            </div>

            {/* Tabla con scroll */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-gray-900 text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Carpeta</th>
                    <th className="px-2 py-2.5 text-center">Téc</th>
                    <th className="px-2 py-2.5 text-center">Aux</th>
                    <th className="px-2 py-2.5 text-center">Sup</th>
                    <th className="px-2 py-2.5 text-center">Otros</th>
                    <th className="px-2.5 py-2.5 text-center font-bold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  {/* Opción Todas las carpetas */}
                  {(() => {
                    const isAllSelected = selectedCarpetaName === "TODAS" && selectedTipoCargo === "todos";
                    return (
                      <tr
                        onClick={() => {
                          setSelectedCarpetaName("TODAS");
                          setSelectedTipoCargo("todos");
                        }}
                        className={`cursor-pointer transition-colors ${
                          isAllSelected
                            ? "bg-gray-100/90 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold"
                            : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        <td className="px-3 py-2.5 font-medium flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-gray-400" />
                          <span>Todas las carpetas</span>
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono text-[11px]">
                          {activeArea?.tecnicos || "-"}
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono text-[11px]">
                          {activeArea?.auxiliares || "-"}
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono text-[11px]">
                          {activeArea?.supervisores || "-"}
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono text-[11px]">
                          {activeArea?.otros || "-"}
                        </td>
                        <td className="px-2.5 py-2.5 text-center font-mono text-xs font-bold">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded ${
                              isAllSelected
                                ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                            }`}
                          >
                            {activeArea?.total || 0}
                          </span>
                        </td>
                      </tr>
                    );
                  })()}

                  {/* Filas de carpetas */}
                  {activeArea?.carpetas?.map((carpeta, idx) => {
                    const isSelected = selectedCarpetaName === carpeta.name;
                    return (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          isSelected
                            ? "bg-gray-100/90 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold"
                            : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        <td
                          onClick={() => {
                            setSelectedCarpetaName(carpeta.name);
                            setSelectedTipoCargo("todos");
                          }}
                          className="px-3 py-2.5 cursor-pointer font-medium hover:text-gray-900 dark:hover:text-white truncate max-w-[140px]"
                          title={carpeta.name}
                        >
                          {carpeta.name}
                        </td>
                        <td
                          onClick={() => {
                            setSelectedCarpetaName(carpeta.name);
                            setSelectedTipoCargo("tecnicos");
                          }}
                          className={`px-2 py-2.5 text-center font-mono text-[11px] cursor-pointer hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded transition-colors ${
                            isSelected && selectedTipoCargo === "tecnicos"
                              ? "bg-gray-200 dark:bg-gray-700 font-bold text-gray-900 dark:text-white"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {carpeta.tecnicos || "-"}
                        </td>
                        <td
                          onClick={() => {
                            setSelectedCarpetaName(carpeta.name);
                            setSelectedTipoCargo("auxiliares");
                          }}
                          className={`px-2 py-2.5 text-center font-mono text-[11px] cursor-pointer hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded transition-colors ${
                            isSelected && selectedTipoCargo === "auxiliares"
                              ? "bg-gray-200 dark:bg-gray-700 font-bold text-gray-900 dark:text-white"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {carpeta.auxiliares || "-"}
                        </td>
                        <td
                          onClick={() => {
                            setSelectedCarpetaName(carpeta.name);
                            setSelectedTipoCargo("supervisores");
                          }}
                          className={`px-2 py-2.5 text-center font-mono text-[11px] cursor-pointer hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded transition-colors ${
                            isSelected && selectedTipoCargo === "supervisores"
                              ? "bg-gray-200 dark:bg-gray-700 font-bold text-gray-900 dark:text-white"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {carpeta.supervisores || "-"}
                        </td>
                        <td
                          onClick={() => {
                            setSelectedCarpetaName(carpeta.name);
                            setSelectedTipoCargo("otros");
                          }}
                          className={`px-2 py-2.5 text-center font-mono text-[11px] cursor-pointer hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded transition-colors ${
                            isSelected && selectedTipoCargo === "otros"
                              ? "bg-gray-200 dark:bg-gray-700 font-bold text-gray-900 dark:text-white"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {carpeta.otros || "-"}
                        </td>
                        <td
                          onClick={() => {
                            setSelectedCarpetaName(carpeta.name);
                            setSelectedTipoCargo("todos");
                          }}
                          className="px-2.5 py-2.5 text-center font-mono text-xs font-bold cursor-pointer hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded transition-colors"
                        >
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded ${
                              isSelected && selectedTipoCargo === "todos"
                                ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                            }`}
                          >
                            {carpeta.total}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer con filtro activo */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between shrink-0">
              <span className="truncate">
                Filtro: {selectedCarpetaName !== "TODAS" ? selectedCarpetaName : "Todas"}
                {selectedTipoCargo !== "todos" && ` (${selectedTipoCargo})`}
              </span>
              {(selectedCarpetaName !== "TODAS" || selectedTipoCargo !== "todos") && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCarpetaName("TODAS");
                    setSelectedTipoCargo("todos");
                  }}
                  className="text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                >
                  Restablecer
                </button>
              )}
            </div>
          </div>

          {/* Panel 3: Colaboradores por Área / Carpeta (4 cols) */}
          <div className="lg:col-span-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-sm overflow-hidden flex flex-col h-[520px] relative">
            {/* Header del Panel */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider truncate">
                    Colaboradores
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                    {empleadosFiltrados.length}
                  </span>
                </div>

                {/* Filtro Multi-check por Cargo */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                      selectedCargosFilter.length > 0
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>{selectedCargosFilter.length > 0 ? `(${selectedCargosFilter.length})` : "Cargos"}</span>
                  </button>

                  {/* Dropdown de Cargos */}
                  {isFilterDropdownOpen && (
                    <div className="absolute right-0 top-9 w-64 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-30 space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">
                          Filtrar por Cargo
                        </span>
                        {selectedCargosFilter.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedCargosFilter([])}
                            className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline font-semibold"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                      <div className="max-h-52 overflow-y-auto space-y-1">
                        {activeArea?.filterByCargo?.map((cargoName, idx) => (
                          <label
                            key={idx}
                            className="flex items-center gap-2 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md cursor-pointer text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCargosFilter.includes(cargoName)}
                              onChange={() => toggleCargoCheckbox(cargoName)}
                              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span className="truncate text-gray-700 dark:text-gray-300 text-[11px]">
                              {cargoName}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Input de Búsqueda Rápida */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar colaborador o cédula..."
                  value={searchEmpleadoQuery}
                  onChange={(e) => setSearchEmpleadoQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Lista de Colaboradores con scroll */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/50">
              {empleadosFiltrados.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  <Users className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2 opacity-60" />
                  No se encontraron colaboradores con este filtro.
                </div>
              ) : (
                empleadosFiltrados.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => onSelectEmpleado && onSelectEmpleado(emp.id)}
                    className="p-3 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 cursor-pointer transition-colors flex items-center justify-between gap-2.5 group"
                    title="Haz clic para ver la ficha 360°"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {emp.foto ? (
                          <img
                            src={emp.foto}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border border-emerald-500/80"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-800/60 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-xs">
                            {emp.nombre_completo.charAt(0)}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {emp.nombre_completo}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {emp.cargo}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 font-mono">
                          <span>{emp.cedula}</span>
                          <span>&bull;</span>
                          <span className="truncate max-w-[110px]">{emp.carpeta}</span>
                        </div>
                      </div>
                    </div>

                    <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-brand-600 dark:text-gray-600 dark:group-hover:text-brand-400 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 2: PERIODO DE PRUEBA */}
      <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                  Periodo de Prueba
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  {data?.periodo_prueba?.length || 0} colaboradores
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Colaboradores ingresados en los últimos 4 meses con contador regresivo a 60 días reglamentarios.
              </p>
            </div>
          </div>

          {/* Buscador de periodo de prueba */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre o área..."
              value={searchPruebaQuery}
              onChange={(e) => setSearchPruebaQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Tabla Periodo de Prueba */}
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 max-h-[380px] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-[10px] font-semibold sticky top-0 z-10 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="px-3.5 py-2.5 text-center w-12">#</th>
                <th className="px-4 py-2.5">Colaborador</th>
                <th className="px-4 py-2.5">Área & Carpeta</th>
                <th className="px-4 py-2.5">Cargo</th>
                <th className="px-3.5 py-2.5 text-center">Fecha Ingreso</th>
                <th className="px-4 py-2.5 text-center">Días Restantes</th>
                <th className="px-3.5 py-2.5 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {periodoPruebaFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                    No hay colaboradores con período de prueba bajo este criterio.
                  </td>
                </tr>
              ) : (
                periodoPruebaFiltrado.map((item, idx) => {
                  let badge = (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" />
                      {item.dias_restantes} días
                    </span>
                  );
                  if (item.dias_restantes <= 0) {
                    badge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                        <AlertTriangle className="w-3 h-3" />
                        Vencido ({item.dias_restantes} d)
                      </span>
                    );
                  } else if (item.dias_restantes <= 10) {
                    badge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        <Clock className="w-3 h-3" />
                        Crítico ({item.dias_restantes} días)
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-3.5 py-2 text-center text-gray-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {item.nombre_completo}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          {item.cedula}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                        <span className="font-medium text-gray-900 dark:text-gray-200">{item.area}</span>
                        <span className="text-gray-400 block text-[11px]">{item.carpeta}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-300 text-[11px]">
                        {item.cargo}
                      </td>
                      <td className="px-3.5 py-2 text-center font-mono text-gray-600 dark:text-gray-300 text-[11px]">
                        {item.fecha_ingreso || "-"}
                      </td>
                      <td className="px-4 py-2 text-center">{badge}</td>
                      <td className="px-3.5 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => onSelectEmpleado && onSelectEmpleado(item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                          title="Ver ficha 360°"
                        >
                          <span>Ver</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECCIÓN 3: ALERTA CONTRATOS */}
      <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                  Alerta Contratos
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {data?.alerta_contratos?.length || 0} contratos
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Supervisión de contratos vencidos y próximos a vencer (≤ 5 días).
              </p>
            </div>
          </div>

          {/* Buscador de alertas de contratos */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por colaborador o cargo..."
              value={searchContratosQuery}
              onChange={(e) => setSearchContratosQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Tabla Alerta Contratos */}
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 max-h-[380px] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-[10px] font-semibold sticky top-0 z-10 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="px-3.5 py-2.5 text-center w-12">#</th>
                <th className="px-4 py-2.5">Colaborador</th>
                <th className="px-4 py-2.5">Tipo Contrato</th>
                <th className="px-3 py-2.5 text-center">Estado</th>
                <th className="px-4 py-2.5">Cargo / Área</th>
                <th className="px-3 py-2.5 text-center">Inicio</th>
                <th className="px-3 py-2.5 text-center">Fin</th>
                <th className="px-4 py-2.5 text-center">Días Restantes</th>
                <th className="px-3.5 py-2.5 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {alertaContratosFiltrada.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs text-gray-400">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                    No hay alertas de contrato bajo este criterio.
                  </td>
                </tr>
              ) : (
                alertaContratosFiltrada.map((item, idx) => {
                  const isVencido = item.dias_restantes <= 0;
                  return (
                    <tr
                      key={idx}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-3.5 py-2 text-center text-gray-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {item.nombre_completo}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          {item.cedula}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {item.tipo_contrato}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            item.estado === "vencido"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {item.estado}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-300 text-[11px]">
                        <div>{item.cargo}</div>
                        <div className="text-gray-400 text-[10px]">{item.area}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-gray-600 dark:text-gray-300 text-[11px]">
                        {item.fecha_inicio || "-"}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-gray-600 dark:text-gray-300 text-[11px]">
                        {item.fecha_fin || "-"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            isVencido
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {isVencido ? (
                            <>
                              <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              Vencido ({item.dias_restantes} d)
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              {item.dias_restantes} días
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => onSelectEmpleado && onSelectEmpleado(item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                          title="Ver ficha 360°"
                        >
                          <span>Ver</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECCIÓN 4: ROTACIÓN POR ÁREA */}
      <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                  Matriz Histórica de Rotación por Área
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                  {data?.rotacion?.areas?.length || 0} áreas
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Comparativa entre {data?.rotacion?.year_anterior} y {data?.rotacion?.year_actual} con desglose de Ingresos y Egresos mes a mes.
              </p>
            </div>
          </div>

          {/* Selector de Año tipo Pills consistente con el resto del sistema */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-lg overflow-x-auto self-start sm:self-auto">
            {data?.rotacion?.years?.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  selectedYear === y
                    ? "bg-brand-600 text-white shadow-xs"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de Rotación */}
        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs text-left min-w-[980px]">
            {/* Header Nivel 1 */}
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[11px] font-semibold uppercase sticky top-0 z-20">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th
                  rowSpan={2}
                  className="px-4 py-3 text-left min-w-[170px] sticky left-0 z-30 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800"
                >
                  Área
                </th>
                <th
                  colSpan={1}
                  className="px-3 py-2 text-center bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-800"
                >
                  {data?.rotacion?.year_anterior}
                </th>
                <th
                  colSpan={13}
                  className="px-3 py-2 text-center bg-brand-50/60 dark:bg-brand-950/40 text-brand-800 dark:text-brand-300 font-bold"
                >
                  {data?.rotacion?.year_actual}
                </th>
              </tr>

              {/* Header Nivel 2 */}
              <tr className="border-b border-gray-200 dark:border-gray-800 text-[10px] text-gray-500 dark:text-gray-400">
                <th className="px-2.5 py-1.5 text-center bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-800 font-mono">
                  (Ing / Egr)
                </th>
                <th className="px-2.5 py-1.5 text-center bg-brand-100 dark:bg-brand-900/50 text-brand-900 dark:text-brand-200 font-bold border-r border-gray-200 dark:border-gray-800">
                  Total Año
                </th>
                {["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"].map(
                  (m, i) => (
                    <th key={i} className="px-2 py-1.5 text-center">
                      {m}
                    </th>
                  )
                )}
              </tr>
            </thead>

            {/* Filas */}
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {data?.rotacion?.areas?.map((area, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {/* Sticky Área Column */}
                  <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white sticky left-0 z-10 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
                    {area.name}
                  </td>

                  {/* Año Anterior */}
                  <td className="px-2.5 py-2.5 text-center font-mono text-[11px] bg-gray-50 dark:bg-gray-800/20 border-r border-gray-100 dark:border-gray-800">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {area.anterior.ingresos}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600 mx-1">/</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      {area.anterior.egresos}
                    </span>
                  </td>

                  {/* Total Año Actual */}
                  <td className="px-2.5 py-2.5 text-center font-mono text-[11px] font-bold bg-brand-50/20 dark:bg-brand-950/20 border-r border-gray-100 dark:border-gray-800">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {area.actual.ingresos}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600 mx-1">/</span>
                    <span className="text-rose-600 dark:text-rose-400">
                      {area.actual.egresos}
                    </span>
                  </td>

                  {/* 12 Meses */}
                  {area.meses.map((m, mIdx) => {
                    const hasMovimiento = m.ingresos > 0 || m.egresos > 0;
                    return (
                      <td key={mIdx} className="px-2 py-2 text-center font-mono text-[11px]">
                        {hasMovimiento ? (
                          <div className="inline-flex items-center gap-0.5">
                            <span
                              className={`font-semibold ${
                                m.ingresos > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-gray-400"
                              }`}
                            >
                              {m.ingresos}
                            </span>
                            <span className="text-gray-300 dark:text-gray-600 mx-0.5">/</span>
                            <span
                              className={`font-semibold ${
                                m.egresos > 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-gray-400"
                              }`}
                            >
                              {m.egresos}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>

            {/* Total Footer */}
            {data?.rotacion?.totales && (
              <tfoot className="bg-gray-50 dark:bg-gray-800 font-bold text-gray-900 dark:text-white border-t-2 border-gray-200 dark:border-gray-700 sticky bottom-0 z-20">
                <tr>
                  <td className="px-4 py-3 uppercase text-[11px] tracking-wider sticky left-0 z-30 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
                    Total General
                  </td>
                  <td className="px-2.5 py-3 text-center font-mono text-xs border-r border-gray-200 dark:border-gray-800">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {data.rotacion.totales.anterior.ingresos}
                    </span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">
                      {data.rotacion.totales.anterior.egresos}
                    </span>
                  </td>
                  <td className="px-2.5 py-3 text-center font-mono text-xs border-r border-gray-200 dark:border-gray-800 bg-brand-100/50 dark:bg-brand-900/40">
                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                      {data.rotacion.totales.actual.ingresos}
                    </span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-rose-600 dark:text-rose-400 font-extrabold">
                      {data.rotacion.totales.actual.egresos}
                    </span>
                  </td>
                  {data.rotacion.totales.meses.map((m, mIdx) => (
                    <td key={mIdx} className="px-2 py-3 text-center font-mono text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {m.ingresos}
                      </span>
                      <span className="text-gray-400 mx-0.5">/</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        {m.egresos}
                      </span>
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
};

export default TablaInforme;
