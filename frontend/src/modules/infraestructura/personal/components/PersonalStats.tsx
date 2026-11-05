// src/modules/infraestructura/personal/components/PersonalStats.tsx
"use client";

import React from "react";
import { Users, UserCheck, GraduationCap, UserX, Car, AlertTriangle, Clock } from "lucide-react";
import { EmpleadoPerfilItem } from "@/types/empleado";
import { usePersonalStore } from "../store/usePersonalStore";

interface Props {
  items: EmpleadoPerfilItem[];
  onOpenAlertas?: () => void;
  onFiltrarPrueba?: () => void;
  onOpenPracticas?: () => void;
  onFiltrarPracticas?: () => void;
}

export const PersonalStats: React.FC<Props> = ({
  items,
  onOpenAlertas,
  onFiltrarPrueba,
  onOpenPracticas,
  onFiltrarPracticas,
}) => {
  const { estadisticas } = usePersonalStore();

  const total = estadisticas?.total ?? items.length;
  const activos = estadisticas?.activos ?? items.filter((i) => i.estado === "ACTIVO").length;
  const enFormacion = estadisticas?.en_formacion ?? items.filter((i) => i.estado === "EN_FORMACION").length;
  const inactivos = estadisticas?.inactivos ?? items.filter((i) => i.estado === "INACTIVO").length;
  const conVehiculo = estadisticas?.con_vehiculo ?? items.filter((i) => Boolean(i.placa_vehiculo)).length;
  const countPrueba = estadisticas?.en_prueba ?? items.filter(
    (i) => i.en_periodo_prueba && typeof i.dias_para_periodo_prueba === "number" && i.dias_para_periodo_prueba >= 0
  ).length;
  const countCritica = estadisticas?.prueba_critica ?? items.filter(
    (i) => typeof i.dias_para_periodo_prueba === "number" && i.dias_para_periodo_prueba <= 15
  ).length;

  const countPracticas =
    estadisticas?.en_practicas ??
    items.filter(
      (i) =>
        i.estado === "ACTIVO" &&
        (i.en_practicas ||
          Boolean(i.practica_lectiva_inicio) ||
          Boolean(i.practica_productiva_inicio) ||
          (i.cargo && i.cargo.toUpperCase().includes("APRENDIZ")))
    ).length;

  const countPracticasCritica =
    estadisticas?.practicas_criticas ??
    items.filter(
      (i) =>
        i.estado === "ACTIVO" &&
        typeof i.dias_para_fin_practica === "number" &&
        i.dias_para_fin_practica <= 15
    ).length;

  const hasPrueba = countCritica > 0 || countPrueba > 0;
  const hasPracticas = countPracticasCritica > 0 || countPracticas > 0;

  const stats = [
    {
      label: "Total Colaboradores",
      value: total,
      icon: <Users className="h-5 w-5 text-brand-600 dark:text-brand-400" />,
      bg: "bg-brand-50 dark:bg-brand-500/10",
    },
    {
      label: "Activos en Operación",
      value: activos,
      sub: total > 0 ? `${Math.round((activos / total) * 100)}% de la nómina` : undefined,
      icon: <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
      label: "En Formación (GH)",
      value: enFormacion,
      sub: "Pendientes por entrega",
      icon: <GraduationCap className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      bg: "bg-amber-50 dark:bg-amber-500/10",
    },
    {
      label: "Flota Asignada",
      value: conVehiculo,
      sub: "Con placa vehicular",
      icon: <Car className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      bg: "bg-indigo-50 dark:bg-indigo-500/10",
    },
    {
      label: "Inactivos / Retirados",
      value: inactivos,
      sub: "Histórico de egresos",
      icon: <UserX className="h-5 w-5 text-gray-600 dark:text-gray-400" />,
      bg: "bg-gray-100 dark:bg-gray-800",
    },
  ];

  return (
    <div className="space-y-3">
      {/* Alertas Rápidas: Período de Prueba & Prácticas SENA (Grid 2 Columnas) */}
      {(hasPrueba || hasPracticas) && (
        <div className={`grid grid-cols-1 ${hasPrueba && hasPracticas ? "md:grid-cols-2" : ""} gap-3`}>
          {/* Card 1: Período de Prueba */}
          {hasPrueba && (
            <div
              className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 shadow-xs transition-all ${
                countCritica > 0
                  ? "border-rose-200/80 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20"
                  : "border-amber-200/50 bg-amber-50/30 dark:border-amber-900/25 dark:bg-amber-950/10"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    countCritica > 0
                      ? "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 animate-pulse"
                      : "bg-amber-100/60 text-amber-600/90 dark:bg-amber-500/10 dark:text-amber-400/80"
                  }`}
                >
                  {countCritica > 0 ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4
                      className={`text-xs font-bold truncate ${
                        countCritica > 0
                          ? "text-rose-900 dark:text-rose-200"
                          : "text-amber-950/90 dark:text-amber-100/80"
                      }`}
                    >
                      {countCritica > 0
                        ? `Período de Prueba: Por Vencer (${countCritica})`
                        : `Período de Prueba (${countPrueba})`}
                    </h4>
                    {countCritica > 0 && (
                      <span className="rounded-full bg-rose-100 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-900/50 dark:border-rose-800 dark:text-rose-300">
                        Crítico &le; 15d
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] truncate mt-0.5 ${
                      countCritica > 0
                        ? "text-rose-700/90 dark:text-rose-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {countCritica > 0
                      ? "Colaboradores próximos a cumplir 2 meses."
                      : "Colaboradores en proceso formativo inicial."}
                  </p>
                </div>
              </div>

              {onOpenAlertas && (
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={onOpenAlertas}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                      countCritica > 0
                        ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40"
                        : "border-amber-200/60 bg-white text-amber-800/80 hover:bg-amber-50/80 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200/80 dark:hover:bg-amber-900/30"
                    }`}
                  >
                    <span>Ver Colaboradores</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Card 2: Aprendices SENA */}
          {hasPracticas && (
            <div
              className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 shadow-xs transition-all ${
                countPracticasCritica > 0
                  ? "border-brand-200/80 bg-brand-50/50 dark:border-brand-900/40 dark:bg-brand-950/25"
                  : "border-brand-200/60 bg-brand-50/30 dark:border-brand-900/30 dark:bg-brand-950/15"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    countPracticasCritica > 0
                      ? "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300 animate-pulse"
                      : "bg-brand-100/70 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                  }`}
                >
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-brand-900 dark:text-brand-200 truncate">
                      {countPracticasCritica > 0
                        ? `Aprendices SENA: Por Vencer (${countPracticasCritica})`
                        : `Aprendices SENA (${countPracticas})`}
                    </h4>
                    {countPracticasCritica > 0 && (
                      <span className="rounded-full bg-brand-100 border border-brand-200 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-900/50 dark:border-brand-800 dark:text-brand-300">
                        Crítico &le; 15d
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] truncate mt-0.5 ${
                      countPracticasCritica > 0
                        ? "text-brand-700/90 dark:text-brand-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {countPracticasCritica > 0
                      ? "Etapa formativa de 6 meses por culminar."
                      : "Seguimiento de etapas lectivas y productivas."}
                  </p>
                </div>
              </div>

              {onOpenPracticas && (
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={onOpenPracticas}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-xs hover:bg-brand-50 dark:border-brand-800/60 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/40 transition-colors cursor-pointer"
                  >
                    <span>Ver Aprendices</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{s.label}</p>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{s.value}</h3>
              {s.sub && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{s.sub}</p>
              )}
            </div>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
};
