// src/modules/infraestructura/personal/components/ModalAlertasPracticas.tsx
"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  GraduationCap,
  Clock,
  Search,
  ArrowRight,
  Filter,
  CheckCircle2,
  Calendar,
  BookOpen,
  Briefcase,
  AlertTriangle,
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

type TabUrgencia = "TODOS" | "CRITICOS" | "SEGUIMIENTO";
type FiltroEtapa = "TODAS" | "LECTIVA" | "PRODUCTIVA";

export const ModalAlertasPracticas: React.FC<Props> = ({
  isOpen,
  onClose,
  items,
  onSelectEmpleado,
  onFiltrarEnTabla,
}) => {
  const [tabUrgencia, setTabUrgencia] = useState<TabUrgencia>("TODOS");
  const [filtroEtapa, setFiltroEtapa] = useState<FiltroEtapa>("TODAS");
  const [search, setSearch] = useState("");
  const [remotosPracticas, setRemotosPracticas] = useState<EmpleadoPerfilItem[]>([]);
  const [isLoadingRemoto, setIsLoadingRemoto] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoadingRemoto(true);
    personalService
      .getEmpleados({ solo_practicas: true, estado: "ACTIVO" })
      .then((data) => {
        if (isMounted) {
          setRemotosPracticas(data);
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

  // Colaboradores activos en prácticas SENA
  const colaboradoresPracticas = useMemo(() => {
    const fuente = remotosPracticas.length > 0 ? remotosPracticas : items;
    return fuente
      .filter(
        (emp) =>
          emp.estado === "ACTIVO" &&
          (emp.en_practicas ||
            emp.practica_lectiva_inicio ||
            emp.practica_productiva_inicio ||
            (emp.cargo && emp.cargo.toUpperCase().includes("APRENDIZ")))
      )
      .sort((a, b) => (a.dias_para_fin_practica ?? 999) - (b.dias_para_fin_practica ?? 999));
  }, [remotosPracticas, items]);

  // Segmentación por urgencia
  const criticos = useMemo(
    () =>
      colaboradoresPracticas.filter(
        (i) => typeof i.dias_para_fin_practica === "number" && i.dias_para_fin_practica <= 15
      ),
    [colaboradoresPracticas]
  );

  const seguimiento = useMemo(
    () =>
      colaboradoresPracticas.filter(
        (i) => typeof i.dias_para_fin_practica === "number" && i.dias_para_fin_practica > 15
      ),
    [colaboradoresPracticas]
  );

  // Filtrado compuesto (Urgencia + Etapa + Búsqueda)
  const colaboradoresFiltrados = useMemo(() => {
    let base = colaboradoresPracticas;
    if (tabUrgencia === "CRITICOS") base = criticos;
    else if (tabUrgencia === "SEGUIMIENTO") base = seguimiento;

    if (filtroEtapa !== "TODAS") {
      base = base.filter((i) => {
        const etapa = i.etapa_practica_activa || (i.practica_productiva_inicio ? "PRODUCTIVA" : "LECTIVA");
        return etapa === filtroEtapa;
      });
    }

    if (!search.trim()) return base;
    const s = search.toLowerCase();
    return base.filter(
      (emp) =>
        emp.nombre_completo.toLowerCase().includes(s) ||
        emp.numero_documento.includes(s) ||
        (emp.cargo && emp.cargo.toLowerCase().includes(s)) ||
        (emp.sede && emp.sede.toLowerCase().includes(s))
    );
  }, [colaboradoresPracticas, criticos, seguimiento, tabUrgencia, filtroEtapa, search]);

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
        {/* Header con morado claro de marca */}
        <div className="shrink-0 flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Aprendices SENA: Alertas de Prácticas
                </h2>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  {colaboradoresPracticas.length} aprendiz{colaboradoresPracticas.length === 1 ? "" : "es"}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Seguimiento preventivo y cálculo de 6 meses para etapas lectivas y productivas.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filters Bar: Segmented Tabs simplificados + Toggle de Etapa */}
        <div className="shrink-0 p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 space-y-3">
          {/* Fila 1: Tabs principales por Urgencia + Botón Filtrar en Tabla */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 bg-gray-200/70 dark:bg-gray-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTabUrgencia("TODOS")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  tabUrgencia === "TODOS"
                    ? "bg-brand-500 text-white shadow-xs font-bold"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Todos ({colaboradoresPracticas.length})
              </button>

              <button
                type="button"
                onClick={() => setTabUrgencia("CRITICOS")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  tabUrgencia === "CRITICOS"
                    ? "bg-rose-600 text-white shadow-xs font-bold"
                    : "text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Críticos &le; 15 días ({criticos.length})
              </button>

              <button
                type="button"
                onClick={() => setTabUrgencia("SEGUIMIENTO")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  tabUrgencia === "SEGUIMIENTO"
                    ? "bg-brand-500 text-white shadow-xs font-bold"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                En Seguimiento ({seguimiento.length})
              </button>
            </div>

            {onFiltrarEnTabla && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onFiltrarEnTabla();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Filtrar en tabla principal</span>
              </button>
            )}
          </div>

          {/* Fila 2: Buscador + Filtro de Etapa Compacto */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {/* Buscador */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por aprendiz, cédula o sede..."
                className="h-9 w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            {/* Toggle de Etapa Compacto */}
            <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-1 rounded-xl shrink-0 self-stretch sm:self-auto">
              <span className="text-[11px] font-semibold text-gray-400 px-2 flex items-center gap-1">
                Etapa:
              </span>
              {(
                [
                  { val: "TODAS", label: "Todas" },
                  { val: "LECTIVA", label: "Lectiva" },
                  { val: "PRODUCTIVA", label: "Productiva" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setFiltroEtapa(opt.val)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                    filtroEtapa === opt.val
                      ? "bg-brand-500 text-white font-semibold shadow-xs"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Body: Tarjetas simplificadas y limpias */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {colaboradoresFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-white">
                No hay aprendices en este criterio
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                No se registran aprendices activos que coincidan con los filtros seleccionados.
              </p>
            </div>
          ) : (
            colaboradoresFiltrados.map((emp) => {
              const dias = emp.dias_para_fin_practica;
              const tieneDias = typeof dias === "number";
              const esVencido = tieneDias && dias < 0;
              const esCritico = tieneDias && dias >= 0 && dias <= 15;
              const esAdvertencia = tieneDias && dias > 15 && dias <= 30;

              const etapa = emp.etapa_practica_activa || (emp.practica_productiva_inicio ? "PRODUCTIVA" : "LECTIVA");
              const fechaFin =
                etapa === "LECTIVA"
                  ? emp.practica_lectiva_fin
                  : etapa === "PRODUCTIVA"
                  ? emp.practica_productiva_fin
                  : emp.practica_productiva_fin || emp.practica_lectiva_fin;

              return (
                <div
                  key={emp.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 transition-all hover:border-brand-300 hover:shadow-xs dark:border-gray-800/80 dark:bg-gray-900"
                >
                  {/* Zona 1: Aprendiz (Avatar + Nombre + Cédula/Sede) */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 text-xs font-bold shadow-2xs overflow-hidden border border-brand-200/40">
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
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectEmpleado(emp.id);
                        }}
                        className="font-bold text-xs sm:text-sm text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400 truncate text-left cursor-pointer"
                      >
                        {emp.nombre_completo}
                      </button>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        <span className="font-mono">{emp.tipo_documento} {emp.numero_documento}</span>
                        <span>•</span>
                        <span>{emp.sede || emp.ciudad_operacion || "Sin sede"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Zona 2: Etapa Activa Limpia (Badge + Fecha Fin) */}
                  <div className="flex items-center sm:justify-center shrink-0 sm:px-4">
                    <div className="flex flex-col sm:items-center gap-1">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[11px] font-bold ${
                          etapa === "LECTIVA"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/40"
                            : etapa === "PRODUCTIVA"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {etapa === "LECTIVA" ? (
                          <>
                            <BookOpen className="w-3 h-3" /> Etapa Lectiva
                          </>
                        ) : etapa === "PRODUCTIVA" ? (
                          <>
                            <Briefcase className="w-3 h-3" /> Etapa Productiva
                          </>
                        ) : (
                          "Culminada"
                        )}
                      </span>

                      {fechaFin && (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span>Vence: <strong>{fechaFin}</strong></span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Zona 3: Semáforo y Botón Ver Ficha */}
                  <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                    {tieneDias ? (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                          esVencido
                            ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
                            : esCritico
                            ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 animate-pulse"
                            : esAdvertencia
                            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            : "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800/50 dark:bg-brand-950/30 dark:text-brand-300"
                        }`}
                      >
                        {esCritico || esVencido ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        <span>
                          {esVencido
                            ? `Vencida (${Math.abs(dias)}d)`
                            : `${dias} día${dias === 1 ? "" : "s"} restante${dias === 1 ? "" : "s"}`}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400 italic">Sin fecha</span>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectEmpleado(emp.id);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl bg-brand-500 hover:bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
                    >
                      <span>Ver Ficha</span>
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
            Mostrando <strong>{colaboradoresFiltrados.length}</strong> de{" "}
            <strong>{colaboradoresPracticas.length}</strong> aprendiz{colaboradoresPracticas.length === 1 ? "" : "es"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
