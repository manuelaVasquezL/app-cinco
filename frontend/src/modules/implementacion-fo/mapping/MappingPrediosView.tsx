"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MapPin,
  Plus,
  ListFilter,
  FileSpreadsheet,
  Building,
  Home,
  Store,
  Layers,
  Sparkles,
  RefreshCw,
  Cloud,
} from "lucide-react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { MappingPredio, MappingPredioFiltros } from "./types";
import { mappingPredioService } from "./services/mappingPredio.service";
import { MappingPredioForm } from "./components/MappingPredioForm";
import { MappingPrediosTable } from "./components/MappingPrediosTable";
import { MappingPredioExcelImportModal } from "./components/MappingPredioExcelImportModal";

type ActiveTab = "formulario" | "listado";

export const MappingPrediosView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("formulario");
  const [predios, setPredios] = useState<MappingPredio[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filtros, setFiltros] = useState<MappingPredioFiltros>({});
  const [predioEditando, setPredioEditando] = useState<MappingPredio | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const cargarPredios = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await mappingPredioService.listar(filtros);
      setPredios(data);
    } catch {
      // Silencioso o notificado en servicio
    } finally {
      setIsLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    cargarPredios();
  }, [cargarPredios]);

  const handleEditarPredio = (predio: MappingPredio) => {
    setPredioEditando(predio);
    setActiveTab("formulario");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGuardadoExitoso = (predio: MappingPredio) => {
    cargarPredios();
    if (predioEditando) {
      setPredioEditando(null);
    }
  };

  // Cálculos de métricas rápidas
  const totalCasas = predios.reduce((acc, p) => acc + (p.num_casas || 0), 0);
  const totalAptos = predios.reduce((acc, p) => acc + (p.num_apartamentos || 0), 0);
  const totalLocales = predios.reduce((acc, p) => acc + (p.num_locales || 0), 0);
  const totalUnidades = totalCasas + totalAptos + totalLocales;
  const barriosUnicos = new Set(predios.map((p) => p.barrio).filter(Boolean)).size;
  const planchasUnicas = new Set(predios.map((p) => p.lote_amp).filter(Boolean)).size;
  const totalSincronizados = predios.filter((p) => p.sp_synced).length;

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle={["Implementación FO", "Mapping de Predios"]} />

      {/* Header Principal del Módulo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Levantamiento y Mapping de Predios
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Censo cartográfico predial sin fricciones para despliegue de red de fibra óptica.
          </p>
        </div>

        {/* Pestañas de Navegación Rápida */}
        <div className="inline-flex rounded-xl border border-gray-200 bg-gray-100/80 p-1 dark:border-gray-800 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab("formulario")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === "formulario"
                ? "bg-white text-brand-600 shadow-xs dark:bg-gray-900 dark:text-brand-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            {predioEditando ? "Editando Predio" : "Registrar Predio"}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("listado")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === "listado"
                ? "bg-white text-brand-600 shadow-xs dark:bg-gray-900 dark:text-brand-400"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            Predios Levantados
            <span className="ml-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
              {predios.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Resumen en Vivo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Predios Levantados</span>
            <Building className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{predios.length}</p>
          <span className="text-[11px] text-gray-400">{barriosUnicos} barrios cubiertos</span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Total Unidades</span>
            <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{totalUnidades}</p>
          <span className="text-[11px] text-gray-400">
            {totalAptos} aptos • {totalCasas} casas • {totalLocales} loc.
          </span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Planchas / AMPs</span>
            <Layers className="h-4 w-4 text-brand-700 dark:text-brand-300" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{planchasUnicas}</p>
          <span className="text-[11px] text-gray-400">Lotes de cartografía</span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">SharePoint (Listas)</span>
            <Cloud className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {totalSincronizados}
            <span className="text-xs font-normal text-gray-400"> / {predios.length}</span>
          </p>
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            {predios.length > 0 && totalSincronizados === predios.length
              ? "100% Sincronizado"
              : `${predios.length - totalSincronizados} pendientes`}
          </span>
        </div>
      </div>

      {/* Renderizado condicional según la pestaña activa */}
      {activeTab === "formulario" ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {predioEditando ? "Modificar Datos del Predio" : "Formulario de Mapping"}
              </h2>
              <p className="text-xs text-gray-500">
                Registra la información del mapping.
              </p>
            </div>
            {predioEditando && (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                Editando ID #{predioEditando.id}
              </span>
            )}
          </div>

          <MappingPredioForm
            predioEditando={predioEditando}
            onGuardadoExitoso={handleGuardadoExitoso}
            onCancelarEdicion={() => {
              setPredioEditando(null);
            }}
          />
        </div>
      ) : (
        <MappingPrediosTable
          predios={predios}
          isLoading={isLoading}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          onRefrescar={cargarPredios}
          onEditarPredio={handleEditarPredio}
          onAbrirImportModal={() => setIsImportModalOpen(true)}
        />
      )}

      {/* Modal de Carga Masiva de Excel */}
      <MappingPredioExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportExitoso={() => {
          cargarPredios();
        }}
      />
    </div>
  );
};

export default MappingPrediosView;
