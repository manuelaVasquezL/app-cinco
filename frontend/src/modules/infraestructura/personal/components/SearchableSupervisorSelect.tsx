// src/modules/infraestructura/personal/components/SearchableSupervisorSelect.tsx
"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, User, X, ChevronDown, Check, Building2, Briefcase } from "lucide-react";
import { SupervisorOption } from "../services/personalService";

interface Props {
  label: string;
  value: string;
  onChange: (id: string) => void;
  supervisores: SupervisorOption[];
  initialName?: string | null;
  areaFiltro?: string;
  placeholder?: string;
  emptyText?: string;
}

export const SearchableSupervisorSelect: React.FC<Props> = ({
  label,
  value,
  onChange,
  supervisores,
  initialName,
  areaFiltro,
  placeholder = "Buscar por nombre, cargo o cédula...",
  emptyText = "Sin asignar",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSupervisor = useMemo(() => {
    if (!value) return null;
    return supervisores.find((s) => String(s.id) === String(value)) || null;
  }, [value, supervisores]);

  // Cerrar desplegable al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredList = useMemo(() => {
    const terms = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);

    let list = supervisores;
    if (terms.length > 0) {
      list = list.filter((s) => {
        const searchBlob = `${s.nombre || ""} ${s.nombre_completo || ""} ${s.documento || ""} ${s.cargo || ""} ${s.area || ""}`.toLowerCase();
        return terms.every((t) => searchBlob.includes(t));
      });
    }

    // Priorizar colaboradores que pertenezcan a la misma área operativa
    if (areaFiltro) {
      const areaUpper = areaFiltro.trim().toUpperCase();
      return [...list].sort((a, b) => {
        const aInArea = a.area && a.area.trim().toUpperCase() === areaUpper ? 1 : 0;
        const bInArea = b.area && b.area.trim().toUpperCase() === areaUpper ? 1 : 0;
        return bInArea - aInArea;
      });
    }

    return list;
  }, [supervisores, searchTerm, areaFiltro]);

  const handleSelect = (supId: string) => {
    onChange(supId);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchTerm("");
    setIsOpen(false);
  };

  const displayName = selectedSupervisor
    ? selectedSupervisor.nombre || selectedSupervisor.nombre_completo
    : initialName || (value ? `Colaborador #${value}` : null);

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
        {label}
      </label>

      {/* Si hay un colaborador seleccionado y el buscador no está abierto */}
      {value && displayName && !isOpen ? (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2 text-xs shadow-xs dark:border-gray-700 dark:bg-gray-800 transition-all">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <User className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">
                {displayName}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 truncate">
                {selectedSupervisor?.documento && (
                  <span>CC {selectedSupervisor.documento}</span>
                )}
                {selectedSupervisor?.cargo && (
                  <span>• {selectedSupervisor.cargo}</span>
                )}
                {selectedSupervisor?.area && (
                  <span className="text-gray-400">• {selectedSupervisor.area}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="rounded px-2 py-1 text-[11px] font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10 transition-colors"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              title="Quitar selección"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Modo buscador */
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              className="h-8 w-full rounded-lg border border-gray-300 bg-white pl-8 pr-7 text-xs text-gray-800 placeholder-gray-400 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            {isOpen && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                className="absolute right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Menú desplegable flotante con resultados */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-800 animate-fade-in">
              {/* Opción de desasignar / limpiar */}
              <div
                onClick={() => handleSelect("")}
                className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/60"
              >
                <span>{emptyText}</span>
                {!value && <Check className="h-3.5 w-3.5 text-brand-600" />}
              </div>

              {filteredList.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-400">
                  No se encontraron colaboradores con este cargo
                </div>
              ) : (
                filteredList.map((sup) => {
                  const isSelected = String(sup.id) === String(value);
                  const isMismaArea = areaFiltro && sup.area && sup.area.trim().toUpperCase() === areaFiltro.trim().toUpperCase();

                  return (
                    <div
                      key={sup.id}
                      onClick={() => handleSelect(String(sup.id))}
                      className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                        isSelected
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                          : "text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold truncate">
                            {sup.nombre || sup.nombre_completo}
                          </span>
                          {isMismaArea && (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                              Misma Área
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                          {sup.documento && <span>CC {sup.documento}</span>}
                          {sup.cargo && <span>• {sup.cargo}</span>}
                          {sup.area && <span className="text-gray-400">• {sup.area}</span>}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
