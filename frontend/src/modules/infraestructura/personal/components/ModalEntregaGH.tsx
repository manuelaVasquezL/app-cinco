// src/modules/infraestructura/personal/components/ModalEntregaGH.tsx
"use client";

import React, { useState, useEffect } from "react";
import { X, SendHorizontal, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DatePicker from "@/components/form/date-picker";
import { EmpleadoPerfilItem, EmpleadoPerfilCompleto } from "@/types/empleado";
import { personalService } from "../services/personalService";
import { usePersonalStore } from "../store/usePersonalStore";

interface Props {
  empleado: EmpleadoPerfilItem | EmpleadoPerfilCompleto;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const toDateOrUndefined = (value?: string | null): Date | undefined => {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const ModalEntregaGH: React.FC<Props> = ({
  empleado,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { supervisores, fetchSupervisores, updateLocalItem } = usePersonalStore();
  const [liderId, setLiderId] = useState<number | "">("");
  const [movil, setMovil] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [observaciones, setObservaciones] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentMovil = empleado.movil || ('laboral' in empleado ? empleado.laboral?.movil : "") || "";

  useEffect(() => {
    if (isOpen) {
      if (supervisores.length === 0) {
        fetchSupervisores();
      }
      setMovil(currentMovil);
    }
  }, [isOpen, supervisores.length, fetchSupervisores, currentMovil]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liderId) {
      toast.error("Debe seleccionar un líder de operaciones");
      return;
    }
    if (!movil.trim()) {
      toast.error("Debe asignar un móvil o cuadrilla de operaciones");
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await personalService.entregarGH(empleado.id, {
        lider_operaciones_id: Number(liderId),
        movil_asignado: movil.trim().toUpperCase(),
        fecha_entrega: fechaEntrega,
        observaciones: observaciones.trim() || undefined,
      });

      toast.success(
        `Personal entregado a operaciones con éxito. Móvil: ${movil.toUpperCase()}`
      );
      updateLocalItem(updated);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al procesar la entrega a operaciones";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:items-center sm:p-4 overflow-y-auto animate-fade-in">
      {/* Overlay con fondo claro difuminado idéntico a Operaciones (Actividades / Agenda) */}
      <div
        className="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px] dark:bg-black/60 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative my-auto w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <SendHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Entrega a Operaciones (GH)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {empleado.nombre_completo} • CC {empleado.numero_documento}
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

        {/* Notice */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-800 dark:border-blue-900/30 dark:bg-blue-950/40 dark:text-blue-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Esta acción certifica que el colaborador culminó su inducción en Gestión Humana y
            pasa a ser responsabilidad del Líder de Operaciones seleccionado.
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Líder / Supervisor Operativo Destino <span className="text-red-500">*</span>
            </label>
            <select
              value={liderId}
              onChange={(e) => setLiderId(e.target.value ? Number(e.target.value) : "")}
              required
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">Seleccione el supervisor operativo...</option>
              {supervisores.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {(sup.nombre || (sup as any).nombre_completo)} {sup.cargo ? `(${sup.cargo})` : ""} {sup.movil ? `- ${sup.movil}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Móvil / Cuadrilla de Operación <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={movil}
              onChange={(e) => setMovil(e.target.value)}
              placeholder="Ej: CUADRILLA 04 / MOVIL 12"
              required
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Fecha de Entrega
            </label>
            <DatePicker
              id="fecha_entrega_operaciones"
              placeholder="AAAA-MM-DD"
              defaultDate={fechaEntrega ? toDateOrUndefined(fechaEntrega) : undefined}
              onChange={(dates: Date[] | Date) => {
                const selected = Array.isArray(dates) ? dates[0] : dates;
                if (selected instanceof Date && !isNaN(selected.getTime())) {
                  const y = selected.getFullYear();
                  const m = String(selected.getMonth() + 1).padStart(2, "0");
                  const d = String(selected.getDate()).padStart(2, "0");
                  setFechaEntrega(`${y}-${m}-${d}`);
                }
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Observaciones de la Entrega
            </label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas sobre dotación entregada, certificados SST, etc."
              className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 focus:outline-hidden disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <SendHorizontal className="h-4 w-4" />
                  <span>Confirmar Entrega</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
