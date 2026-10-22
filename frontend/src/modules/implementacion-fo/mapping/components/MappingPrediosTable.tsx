"use client";

import React, { useState } from "react";
import {
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  ExternalLink,
  Building,
  MapPin,
  Calendar,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/ui/button/Button";
import { DownloadIcon } from "@/icons";
import { MappingPredio, MappingPredioFiltros } from "../types";
import { mappingPredioService } from "../services/mappingPredio.service";

interface MappingPrediosTableProps {
  predios: MappingPredio[];
  isLoading: boolean;
  filtros: MappingPredioFiltros;
  onFiltrosChange: (filtros: MappingPredioFiltros) => void;
  onRefrescar: () => void;
  onEditarPredio: (predio: MappingPredio) => void;
  onAbrirImportModal: () => void;
}

export const MappingPrediosTable: React.FC<MappingPrediosTableProps> = ({
  predios,
  isLoading,
  filtros,
  onFiltrosChange,
  onRefrescar,
  onEditarPredio,
  onAbrirImportModal,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleExportarExcel = async () => {
    setIsExporting(true);
    toast.info("Generando archivo Excel de predios...");
    try {
      const blob = await mappingPredioService.exportarExcel(filtros);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mapping_predios_fo_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Excel descargado exitosamente");
    } catch {
      toast.error("Error al exportar a Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const handleEliminar = async (id: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este predio del levantamiento?")) {
      return;
    }

    setDeletingId(id);
    try {
      await mappingPredioService.eliminar(id);
      toast.success("Predio eliminado correctamente");
      onRefrescar();
    } catch {
      toast.error("No se pudo eliminar el predio");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de Búsqueda y Botones de Acción */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={filtros.buscar || ""}
            onChange={(e) => onFiltrosChange({ ...filtros, buscar: e.target.value })}
            placeholder="Buscar por calle, placa, conjunto, barrio o plancha..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto flex items-center justify-center gap-2"
            onClick={onRefrescar}
            disabled={isLoading}
            startIcon={
              <RefreshCw
                className={`h-4 w-4 text-gray-500 dark:text-gray-400 ${isLoading ? "animate-spin" : ""}`}
              />
            }
          >
            Refrescar
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto flex items-center justify-center gap-2"
            onClick={onAbrirImportModal}
            startIcon={
              <svg
                className="h-4 w-4 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            }
          >
            Cargar CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto flex items-center justify-center gap-2"
            onClick={handleExportarExcel}
            disabled={isExporting || !predios.length}
            startIcon={<DownloadIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
          >
            {isExporting ? "Exportando..." : "Exportar Excel"}
          </Button>
        </div>
      </div>

      {/* Tabla de Predios */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-200 bg-gray-50/75 text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Dirección & Conjunto</th>
                <th className="px-4 py-3">Barrio & AMP</th>
                <th className="px-4 py-3 text-center">Unidades</th>
                <th className="px-4 py-3 text-center">Pisos</th>
                <th className="px-4 py-3">GPS / Coordenadas</th>
                <th className="px-4 py-3">Registro & Recolector</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    <p className="mt-2 text-xs">Cargando predios levantados...</p>
                  </td>
                </tr>
              ) : predios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <Building className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
                    <p className="mt-2 font-medium">No se encontraron predios registrados</p>
                    <p className="text-[11px] text-gray-400">
                      Usa el formulario para capturar un nuevo predio o sube un archivo CSV.
                    </p>
                  </td>
                </tr>
              ) : (
                predios.map((predio) => (
                  <tr
                    key={predio.id}
                    className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {/* Dirección */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {predio.nombre_calle} #{predio.placa_unidad}
                        {predio.interior && (
                          <span className="ml-1 rounded-sm bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            Int. {predio.interior}
                          </span>
                        )}
                      </div>
                      {predio.nombre_conjunto && (
                        <div className="text-[11px] text-brand-600 dark:text-brand-400 font-medium">
                          {predio.nombre_conjunto}
                        </div>
                      )}
                      {(predio.calle_alterna_2 || predio.placa_alterna_2) && (
                        <div className="text-[10px] text-gray-400">
                          Alt: {predio.calle_alterna_2} #{predio.placa_alterna_2}
                        </div>
                      )}
                    </td>

                    {/* Barrio & AMP */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {predio.barrio || "—"}
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                        AMP: {predio.lote_amp || "—"}
                      </div>
                    </td>

                    {/* Unidades */}
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                        {predio.total_unidades}
                      </span>
                      <div className="mt-0.5 flex justify-center gap-1.5 text-[10px] text-gray-400">
                        <span title="Casas">{predio.num_casas}C</span>
                        <span>/</span>
                        <span title="Apartamentos">{predio.num_apartamentos}A</span>
                        <span>/</span>
                        <span title="Locales">{predio.num_locales}L</span>
                      </div>
                    </td>

                    {/* Pisos */}
                    <td className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">
                      {predio.num_pisos}
                    </td>

                    {/* GPS */}
                    <td className="px-4 py-3">
                      {predio.latitud && predio.longitud ? (
                        <a
                          href={`https://www.google.com/maps?q=${predio.latitud},${predio.longitud}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          <MapPin className="h-3 w-3" />
                          {Number(predio.latitud).toFixed(4)}, {Number(predio.longitud).toFixed(4)}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-gray-400">Sin GPS</span>
                      )}
                    </td>

                    {/* Registro & Recolector */}
                    <td className="px-4 py-3">
                      <div className="text-[11px] font-medium text-gray-800 dark:text-gray-200">
                        {predio.created_by_nombre || "Sistema"}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {new Date(predio.created_at).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEditarPredio(predio)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800 dark:hover:text-brand-400"
                          title="Editar predio"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === predio.id}
                          onClick={() => handleEliminar(predio.id)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          title="Eliminar predio"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
