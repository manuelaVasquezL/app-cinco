// src/modules/infraestructura/personal/components/ModalSolicitarTraslado.tsx
"use client";

import React, { useState, useEffect } from "react";
import { X, ArrowLeftRight, Loader2, SendHorizontal, Building2, Folder, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { EmpleadoPerfilCompleto, EmpleadoPerfilItem, AreasCarpetasResponse } from "@/types/empleado";
import { personalService } from "../services/personalService";
import { usePersonalStore } from "../store/usePersonalStore";

interface Props {
  empleado: EmpleadoPerfilCompleto | EmpleadoPerfilItem;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ModalSolicitarTraslado: React.FC<Props> = ({
  empleado,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { fetchEmpleadoDetail } = usePersonalStore();
  const [nuevaArea, setNuevaArea] = useState("");
  const [nuevaCarpeta, setNuevaCarpeta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Catálogo de áreas y carpetas (estrictamente de EmpleadoLaboral en BD default)
  const [catalogo, setCatalogo] = useState<AreasCarpetasResponse | null>(null);
  const [isLoadingCatalogo, setIsLoadingCatalogo] = useState(false);

  const laboral = "laboral" in empleado ? empleado.laboral : null;
  const areaActual = laboral?.area || ("area" in empleado ? (empleado as any).area : "") || "Sin asignar";
  const carpetaActual = laboral?.carpeta || ("carpeta" in empleado ? (empleado as any).carpeta : "") || "Sin asignar";
  const cargoActual = laboral?.cargo || ("cargo" in empleado ? (empleado as any).cargo : "") || "Sin cargo";

  useEffect(() => {
    if (isOpen) {
      const cargarCatalogo = async () => {
        setIsLoadingCatalogo(true);
        try {
          const data = await personalService.getAreasCarpetas();
          setCatalogo(data);
        } catch (error) {
          console.error("Error al cargar catálogo de áreas y carpetas:", error);
        } finally {
          setIsLoadingCatalogo(false);
        }
      };
      cargarCatalogo();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const carpetasDisponibles = nuevaArea && catalogo?.carpetas_por_area
    ? catalogo.carpetas_por_area[nuevaArea] || []
    : [];

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setNuevaArea(val);
    setNuevaCarpeta("");
  };

  const handleCarpetaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNuevaCarpeta(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const areaClean = nuevaArea.trim().toUpperCase();
    const carpetaClean = nuevaCarpeta.trim().toUpperCase();
    const motivoClean = motivo.trim();

    if (!areaClean) {
      toast.error("Debe seleccionar el área de destino");
      return;
    }
    if (!carpetaClean) {
      toast.error("Debe seleccionar la carpeta de destino");
      return;
    }
    if (!motivoClean || motivoClean.length < 10) {
      toast.error("Por favor ingrese un motivo detallado (mínimo 10 caracteres)");
      return;
    }

    if (areaClean === areaActual.toUpperCase() && carpetaClean === carpetaActual.toUpperCase()) {
      toast.error("El área y carpeta de destino deben ser diferentes a las actuales");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await personalService.solicitarTraslado(empleado.id, {
        area: areaClean,
        carpeta: carpetaClean,
        motivo: motivoClean,
      });

      toast.success(
        res?.msg || "La solicitud fue recibida por Gestión Humana y será atendida lo más pronto posible."
      );
      await fetchEmpleadoDetail(empleado.id);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar la solicitud de traslado";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:items-center sm:p-4 overflow-y-auto animate-fade-in">
      {/* Overlay translúcido */}
      <div
        className="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px] dark:bg-black/60 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div className="relative my-auto w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Solicitud Formal de Traslado
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cambio de Área y Carpeta Operativa • {empleado.nombre_completo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tarjeta de Ubicación Actual */}
        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800/80 dark:bg-gray-800/40">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400 mb-2">
            Ubicación Operativa Actual
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                Área Actual:
              </span>
              <p className="font-semibold text-gray-900 dark:text-white mt-0.5 truncate">
                {areaActual}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Folder className="h-3.5 w-3.5 text-gray-400" />
                Carpeta Actual:
              </span>
              <p className="font-semibold text-gray-900 dark:text-white mt-0.5 truncate">
                {carpetaActual}
              </p>
            </div>
            <div className="col-span-2 pt-1 border-t border-gray-200/50 dark:border-gray-700/50">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Cargo: <strong className="text-gray-800 dark:text-gray-200 font-medium">{cargoActual}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Formulario de Solicitud */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Selector Estricto Nueva Área */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                <span>Nueva Área <span className="text-red-500">*</span></span>
                {isLoadingCatalogo && <Loader2 className="h-3 w-3 animate-spin text-cyan-600" />}
              </label>
              <div className="relative">
                <select
                  value={nuevaArea}
                  onChange={handleAreaChange}
                  disabled={isLoadingCatalogo}
                  required
                  className="h-10 w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 pr-8 text-xs font-medium text-gray-800 focus:border-cyan-500 focus:outline-hidden disabled:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:disabled:bg-gray-900"
                >
                  <option value="">-- Seleccione Área --</option>
                  {catalogo?.areas.map((ar) => (
                    <option key={ar} value={ar}>
                      {ar}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Selector Estricto Nueva Carpeta (Dependiente de Área) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Nueva Carpeta <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={nuevaCarpeta}
                  onChange={handleCarpetaChange}
                  disabled={!nuevaArea || isLoadingCatalogo}
                  required
                  className="h-10 w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 pr-8 text-xs font-medium text-gray-800 focus:border-cyan-500 focus:outline-hidden disabled:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:disabled:bg-gray-900"
                >
                  <option value="">
                    {!nuevaArea ? "Primero seleccione un área..." : "-- Seleccione Carpeta --"}
                  </option>
                  {carpetasDisponibles.map((carp) => (
                    <option key={carp} value={carp}>
                      {carp}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
              <span>Justificación / Motivo del Traslado <span className="text-red-500">*</span></span>
              <span className="text-[10px] text-gray-400">Mínimo 10 caracteres</span>
            </label>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explique el motivo que sustenta este traslado..."
              required
              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-xs text-gray-800 placeholder-gray-400 focus:border-cyan-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Nota Informativa */}
          <div className="flex items-start gap-2.5 rounded-xl border border-cyan-100 bg-cyan-50/70 p-3 text-xs text-cyan-900 dark:border-cyan-800/40 dark:bg-cyan-950/40 dark:text-cyan-300">
            <SendHorizontal className="h-4 w-4 shrink-0 mt-0.5 text-cyan-600 dark:text-cyan-400" />
            <span>
              Al emitir esta solicitud, el sistema encolará una notificación por correo formal hacia <strong>Gestión Humana</strong> y <strong>Programación</strong>, y registrará el sello de auditoría en el historial del colaborador.
            </span>
          </div>

          {/* Footer Botones */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 rounded-lg px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-500 focus:outline-hidden disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Enviando Solicitud...</span>
                </>
              ) : (
                <>
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>Enviar Solicitud</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
