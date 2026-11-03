// src/modules/infraestructura/personal/components/ModalReactivar.tsx
"use client";

import React, { useState, useEffect } from "react";
import { X, UserCheck, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EmpleadoPerfilItem, EmpleadoPerfilCompleto } from "@/types/empleado";
import { personalService } from "../services/personalService";
import { usePersonalStore } from "../store/usePersonalStore";

interface Props {
  empleado: EmpleadoPerfilItem | EmpleadoPerfilCompleto;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ModalReactivar: React.FC<Props> = ({
  empleado,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { updateLocalItem } = usePersonalStore();
  const [observaciones, setObservaciones] = useState("");
  const [movilRestaurar, setMovilRestaurar] = useState<string>("1 - SIN ASIGNAR");
  const [cargandoMovil, setCargandoMovil] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && empleado?.id) {
      setCargandoMovil(true);
      personalService
        .getMovilPrevia(empleado.id)
        .then((res) => {
          if (res?.movil_previa) {
            setMovilRestaurar(res.movil_previa);
          }
        })
        .catch(() => {
          setMovilRestaurar("1 - SIN ASIGNAR");
        })
        .finally(() => {
          setCargandoMovil(false);
        });
    }
  }, [isOpen, empleado?.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updated = await personalService.reactivarEmpleado(empleado.id, {
        movil_inicial: movilRestaurar.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
      });

      toast.success(
        `Empleado ${empleado.nombre_completo} reactivado con éxito como ACTIVO con móvil ${movilRestaurar}.`
      );
      updateLocalItem(updated);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al reactivar empleado";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:items-center sm:p-4 overflow-y-auto animate-fade-in">
      {/* Overlay con fondo claro difuminado */}
      <div
        className="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px] dark:bg-black/60 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative my-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Reactivar Colaborador
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

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            Esta acción restaurará el estado a <strong>ACTIVO</strong> y reactivará credenciales.
            <br />
            <small className="text-emerald-700/80 dark:text-emerald-400/80">
              Esta acción solo debe realizarse con precaución en caso de reactivación autorizada.
            </small>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Móvil a Restaurar / Asignar (Regla Legacy 2.7)
            </label>
            <div className="relative">
              <input
                type="text"
                value={movilRestaurar}
                onChange={(e) => setMovilRestaurar(e.target.value.toUpperCase())}
                placeholder="Ej: TIRAN01 / 1 - SIN ASIGNAR"
                className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 font-mono text-xs uppercase text-gray-800 focus:border-emerald-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              {cargandoMovil && (
                <div className="absolute right-2.5 top-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Móvil recuperado automáticamente del historial de auditoría previo al retiro.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Motivo o Justificación de la Reactivación
            </label>
            <textarea
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Reingreso, reactivación por error involuntario de retiro..."
              className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-800 focus:border-emerald-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus:outline-hidden disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Reactivando...</span>
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  <span>Confirmar Reactivación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
