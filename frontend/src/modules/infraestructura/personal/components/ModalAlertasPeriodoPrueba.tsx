// src/modules/infraestructura/personal/components/ModalAlertasPeriodoPrueba.tsx
"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  AlertTriangle,
  Clock,
  User,
  Search,
  ArrowRight,
  Filter,
  CheckCircle2,
  Calendar,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import { EmpleadoPerfilItem } from "@/types/empleado";
import { resolveFotoUrl, getInitials } from "./personalTable.utils";
import { personalService } from "../services/personalService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: EmpleadoPerfilItem[];
  onSelectEmpleado: (id: number) => void;
  onFiltrarEnTabla?: () => void;
}

type TabFiltro = "TODOS" | "CRITICOS" | "ADVERTENCIA" | "NORMAL";

export const ModalAlertasPeriodoPrueba: React.FC<Props> = ({
  isOpen,
  onClose,
  items,
  onSelectEmpleado,
  onFiltrarEnTabla,
}) => {
  const [tabFiltro, setTabFiltro] = useState<TabFiltro>("TODOS");
  const [search, setSearch] = useState("");
  const [remotosPrueba, setRemotosPrueba] = useState<EmpleadoPerfilItem[]>([]);
  const [isLoadingRemoto, setIsLoadingRemoto] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoadingRemoto(true);
    personalService
      .getEmpleados({ periodo_prueba: true, estado: "ACTIVO" })
      .then((data) => {
        if (isMounted) {
          setRemotosPrueba(data);
          setIsLoadingRemoto(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingRemoto(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Colaboradores activos en período de prueba
  const colaboradoresEnPrueba = useMemo(() => {
    const fuente = remotosPrueba.length > 0 ? remotosPrueba : items;
    return fuente
      .filter(
        (emp) =>
          emp.estado === "ACTIVO" &&
          (emp.en_periodo_prueba || (typeof emp.dias_para_periodo_prueba === "number" && emp.dias_para_periodo_prueba >= 0))
      )
      .sort((a, b) => (a.dias_para_periodo_prueba ?? 999) - (b.dias_para_periodo_prueba ?? 999));
  }, [remotosPrueba, items]);

  const criticos = useMemo(
    () => colaboradoresEnPrueba.filter((i) => (i.dias_para_periodo_prueba ?? 99) <= 15),
    [colaboradoresEnPrueba]
  );

  const advertencia = useMemo(
    () =>
      colaboradoresEnPrueba.filter(
        (i) => (i.dias_para_periodo_prueba ?? 99) > 15 && (i.dias_para_periodo_prueba ?? 99) <= 30
      ),
    [colaboradoresEnPrueba]
  );

  const normales = useMemo(
    () => colaboradoresEnPrueba.filter((i) => (i.dias_para_periodo_prueba ?? 0) > 30),
    [colaboradoresEnPrueba]
  );

  // Filtrado por tab y texto
  const colaboradoresFiltrados = useMemo(() => {
    let base = colaboradoresEnPrueba;
    if (tabFiltro === "CRITICOS") base = criticos;
    else if (tabFiltro === "ADVERTENCIA") base = advertencia;
    else if (tabFiltro === "NORMAL") base = normales;

    if (!search.trim()) return base;
    const s = search.toLowerCase();
    return base.filter(
      (emp) =>
        emp.nombre_completo.toLowerCase().includes(s) ||
        emp.numero_documento.includes(s) ||
        (emp.cargo && emp.cargo.toLowerCase().includes(s)) ||
        (emp.supervisor_directo_nombre && emp.supervisor_directo_nombre.toLowerCase().includes(s)) ||
        (emp.sede && emp.sede.toLowerCase().includes(s))
    );
  }, [colaboradoresEnPrueba, criticos, advertencia, normales, tabFiltro, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Colaboradores en Período de Prueba (2 Meses)
                </h2>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  {colaboradoresEnPrueba.length} total
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Seguimiento preventivo de evaluaciones de inducción antes del vencimiento contractual.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filters and Tabs */}
        <div className="shrink-0 p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 space-y-3">
          {/* Tabs por urgencia */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setTabFiltro("TODOS")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  tabFiltro === "TODOS"
                    ? "bg-brand-600 text-white shadow-xs"
                    : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                Todos ({colaboradoresEnPrueba.length})
              </button>

              <button
                type="button"
                onClick={() => setTabFiltro("CRITICOS")}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  tabFiltro === "CRITICOS"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-white text-rose-700 hover:bg-rose-50 dark:bg-gray-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Críticos &le; 15 días ({criticos.length})
              </button>

              <button
                type="button"
                onClick={() => setTabFiltro("ADVERTENCIA")}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  tabFiltro === "ADVERTENCIA"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "bg-white text-amber-700 hover:bg-amber-50 dark:bg-gray-900 dark:text-amber-400 dark:hover:bg-amber-950/30"
                }`}
              >
                Advertencia 16-30 días ({advertencia.length})
              </button>

              <button
                type="button"
                onClick={() => setTabFiltro("NORMAL")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  tabFiltro === "NORMAL"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white text-emerald-700 hover:bg-emerald-50 dark:bg-gray-900 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                }`}
              >
                En curso &gt; 30 días ({normales.length})
              </button>
            </div>

            {onFiltrarEnTabla && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onFiltrarEnTabla();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Filtrar en tabla principal</span>
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por colaborador, documento, cargo o supervisor..."
              className="h-9 w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Content Body / Lista de Colaboradores */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {colaboradoresFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-white">
                No hay colaboradores en este criterio
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                No se registran colaboradores activos que coincidan con el filtro seleccionado.
              </p>
            </div>
          ) : (
            colaboradoresFiltrados.map((emp) => {
              const dias = emp.dias_para_periodo_prueba ?? 0;
              const esCritico = dias <= 15;
              const esAdvertencia = dias > 15 && dias <= 30;

              return (
                <div
                  key={emp.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 transition-all hover:border-gray-300 hover:shadow-xs dark:border-gray-800 dark:bg-gray-900"
                >
                  {/* Info Colaborador */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-xs font-bold text-white shadow-xs overflow-hidden">
                      {resolveFotoUrl(emp.foto_url || emp.foto_perfil_url) ? (
                        <img
                          src={resolveFotoUrl(emp.foto_url || emp.foto_perfil_url)}
                          alt={emp.nombre_completo}
                          className="h-full w-full rounded-xl object-cover"
                        />
                      ) : (
                        getInitials(emp.nombre_completo)
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectEmpleado(emp.id);
                          }}
                          className="font-bold text-sm text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400 truncate text-left"
                        >
                          {emp.nombre_completo}
                        </button>
                        <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                          {emp.tipo_documento} {emp.numero_documento}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {emp.cargo || "Sin cargo"}
                        </span>
                        <span>•</span>
                        <span>{emp.sede || emp.ciudad_operacion || "Sin sede"}</span>
                        {emp.supervisor_directo_nombre && (
                          <>
                            <span>•</span>
                            <span className="truncate">
                              Líder: <strong className="text-gray-700 dark:text-gray-300">{emp.supervisor_directo_nombre}</strong>
                            </span>
                          </>
                        )}
                        {emp.fecha_ingreso && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              <Calendar className="h-3 w-3" /> Ingreso: {emp.fecha_ingreso}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Semáforo & Botón Acción */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                        esCritico
                          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                          : esAdvertencia
                          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>{dias} día{dias === 1 ? "" : "s"} restante{dias === 1 ? "" : "s"}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectEmpleado(emp.id);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-500 transition-colors"
                    >
                      <span>Ver Ficha 360°</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Mostrando <strong>{colaboradoresFiltrados.length}</strong> de <strong>{colaboradoresEnPrueba.length}</strong> colaborador{colaboradoresEnPrueba.length === 1 ? "" : "es"} en período de prueba
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

