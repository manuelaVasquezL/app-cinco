// src/modules/infraestructura/personal/components/PersonalFiltersBar.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Search, RotateCcw, UserPlus, Clock } from "lucide-react";
import { usePersonalStore } from "../store/usePersonalStore";
import { EstadoEmpleado } from "@/types/empleado";

interface Props {
  onOpenNuevoEmpleado: () => void;
}

export const PersonalFiltersBar: React.FC<Props> = ({ onOpenNuevoEmpleado }) => {
  const {
    items,
    filters,
    estadisticas,
    setFilter,
    setEstadoTab,
    resetFilters,
    fetchEmpleados,
    soloPeriodoPrueba,
    setSoloPeriodoPrueba,
  } = usePersonalStore();

  const countPrueba =
    estadisticas?.en_prueba ??
    (items || []).filter(
      (i) =>
        i.estado === "ACTIVO" &&
        i.en_periodo_prueba &&
        typeof i.dias_para_periodo_prueba === "number" &&
        i.dias_para_periodo_prueba >= 0
    ).length;

  const [localSearch, setLocalSearch] = useState(filters.search || "");

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.search) {
        setFilter("search", localSearch);
        fetchEmpleados();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch, filters.search, setFilter, fetchEmpleados]);

  const currentTab = filters.estado || "TODOS";

  const tabs: { key: EstadoEmpleado | "TODOS"; label: string }[] = [
    { key: "TODOS", label: "Todos" },
    { key: "ACTIVO", label: "Activos" },
    { key: "EN_FORMACION", label: "En Formación (GH)" },
    { key: "INACTIVO", label: "Inactivos" },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        {/* Lado izquierdo: Buscador + Filtros de estado al lado */}
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {/* Buscador */}
          <div className="relative w-full sm:w-72 md:w-80 lg:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Buscar por cédula, nombre, cargo, móvil o placa..."
              className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50/70 pl-9 pr-4 text-xs text-gray-800 focus:border-brand-500 focus:bg-white focus:outline-hidden dark:border-gray-800 dark:bg-gray-800/40 dark:text-white dark:focus:bg-gray-900"
            />
          </div>

          {/* Botones de estado (Todos, Activos, En Formación, Inactivos, Período de Prueba) */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setEstadoTab(tab.key)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  !soloPeriodoPrueba && currentTab === tab.key
                    ? "bg-brand-500 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}

            {/* Pestaña de Filtro Directo: Período de Prueba */}
            <button
              type="button"
              onClick={() => {
                if (soloPeriodoPrueba) {
                  setEstadoTab("ACTIVO");
                } else {
                  setEstadoTab("PERIODO_PRUEBA");
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                soloPeriodoPrueba
                  ? "bg-brand-500 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              <Clock className={`h-3.5 w-3.5 ${soloPeriodoPrueba ? "text-white" : "text-amber-500"}`} />
              <span>Período de Prueba</span>
              {countPrueba > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    soloPeriodoPrueba
                      ? "bg-white/20 text-white"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  {countPrueba}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Lado derecho: Acciones Restablecer y Nuevo Colaborador */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={resetFilters}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restablecer</span>
          </button>
          <button
            onClick={onOpenNuevoEmpleado}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-brand-500"
          >
            <UserPlus className="h-4 w-4" />
            <span>Nuevo Colaborador</span>
          </button>
        </div>
      </div>
    </div>
  );
};
