// src/modules/infraestructura/personal/components/PersonalFiltersBar.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Search, RotateCcw, Filter, UserPlus } from "lucide-react";
import { usePersonalStore } from "../store/usePersonalStore";
import { EstadoEmpleado } from "@/types/empleado";

interface Props {
  onOpenNuevoEmpleado: () => void;
}

export const PersonalFiltersBar: React.FC<Props> = ({ onOpenNuevoEmpleado }) => {
  const { filters, setFilter, setEstadoTab, resetFilters, fetchEmpleados } =
    usePersonalStore();

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
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
      {/* Top row: search + action button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar por cédula, nombre, cargo, móvil o placa..."
            className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50/70 pl-9 pr-4 text-xs text-gray-800 focus:border-brand-500 focus:bg-white focus:outline-hidden dark:border-gray-800 dark:bg-gray-800/40 dark:text-white dark:focus:bg-gray-900"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
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

      {/* Bottom row: status pills + quick selects */}
      <div className="flex flex-col gap-3 pt-3 border-t border-gray-100 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setEstadoTab(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                currentTab === tab.key
                  ? "bg-brand-500 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* City Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <select
            value={filters.ciudad || ""}
            onChange={(e) => {
              setFilter("ciudad", e.target.value || undefined);
              fetchEmpleados();
            }}
            className="h-8 rounded-lg border border-gray-200 bg-transparent px-2.5 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-300"
          >
            <option value="">Todas las Ciudades</option>
            <option value="CALI">Cali</option>
            <option value="PALMIRA">Palmira</option>
            <option value="YUMBO">Yumbo</option>
            <option value="JAMUNDI">Jamundí</option>
            <option value="BUENAVENTURA">Buenaventura</option>
            <option value="POPAYAN">Popayán</option>
            <option value="BOGOTA">Bogotá</option>
          </select>
        </div>
      </div>
    </div>
  );
};
