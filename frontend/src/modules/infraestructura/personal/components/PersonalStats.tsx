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
}

export const PersonalStats: React.FC<Props> = ({ items, onOpenAlertas, onFiltrarPrueba }) => {
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
      {countCritica > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-3.5 shadow-xs dark:border-rose-900/50 dark:bg-rose-950/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400 animate-pulse">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300">
                  Alerta Global: Período de Prueba por Vencer ({countCritica} colaborador{countCritica > 1 ? "es" : ""})
                </h4>
                <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                  Crítico &le; 15 días
                </span>
              </div>
              <p className="text-[11px] text-rose-700/90 dark:text-rose-400 mt-0.5">
                Hay colaboradores a punto de cumplir sus 2 meses de prueba sin concepto definitivo de inducción/desempeño.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenAlertas && (
              <button
                type="button"
                onClick={onOpenAlertas}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-500 transition-colors cursor-pointer"
              >
                <span>Ver Colaboradores ({countCritica})</span>
              </button>
            )}
            {onFiltrarPrueba && (
              <button
                type="button"
                onClick={onFiltrarPrueba}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100/60 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 transition-colors cursor-pointer"
              >
                <span>Filtrar en Tabla</span>
              </button>
            )}
          </div>
        </div>
      )}

      {countCritica === 0 && countPrueba > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-300">
                Seguimiento de Período de Prueba ({countPrueba} colaborador{countPrueba > 1 ? "es" : ""})
              </p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-400">
                Colaboradores en proceso formativo dentro de sus primeros 2 meses calendario.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenAlertas && (
              <button
                type="button"
                onClick={onOpenAlertas}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-500 transition-colors cursor-pointer"
              >
                <span>Ver Lista Completa</span>
              </button>
            )}
            {onFiltrarPrueba && (
              <button
                type="button"
                onClick={onFiltrarPrueba}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 transition-colors cursor-pointer"
              >
                <span>Filtrar en Tabla</span>
              </button>
            )}
          </div>
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
