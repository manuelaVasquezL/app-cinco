// src/modules/infraestructura/personal/components/ModalDesactivar.tsx
"use client";

import React, { useState } from "react";
import { X, UserMinus, AlertTriangle, Loader2 } from "lucide-react";
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

const MOTIVOS_GH = [
  "RENUNCIA VOLUNTARIA",
  "TERMINACION DE CONTRATO POR JUSTA CAUSA",
  "TERMINACION DE CONTRATO SIN JUSTA CAUSA",
  "VENCIMIENTO DE CONTRATO OBRA Y LABOR",
  "MUTUO ACUERDO",
  "PERIODO DE PRUEBA NO SUPERADO",
  "ABANDONO DEL CARGO",
  "OTRO",
];

export const ModalDesactivar: React.FC<Props> = ({
  empleado,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { updateLocalItem } = usePersonalStore();
  const [motivoGH, setMotivoGH] = useState("");
  const [motivoOperaciones, setMotivoOperaciones] = useState("");
  const [fechaRetiro, setFechaRetiro] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivoGH.trim()) {
      toast.error("Debe ingresar o seleccionar el motivo de retiro de Gestión Humana");
      return;
    }
    if (!motivoOperaciones.trim()) {
      toast.error("Debe ingresar el motivo de retiro operativo");
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await personalService.desactivarEmpleado(empleado.id, {
        motivo_retiro_gh: motivoGH.trim().toUpperCase(),
        motivo_retiro_operaciones: motivoOperaciones.trim().toUpperCase(),
        fecha_retiro: fechaRetiro,
      });

      toast.success(`Empleado ${empleado.nombre_completo} desactivado del sistema.`);
      updateLocalItem(updated);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al desactivar empleado";
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400">
              <UserMinus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Desactivar Colaborador (Egreso)
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

        {/* Warning Rules */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs text-red-900 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="space-y-1">
            <p><strong>Efectos colaterales del retiro:</strong></p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>El usuario en sistema (login) será revocado y desactivado.</li>
              <li>La placa vehicular ({empleado.placa_vehiculo || ('movilidad' in empleado ? empleado.movilidad?.placa_vehiculo : "") || "ninguna"}) será desvinculada y liberada.</li>
              <li>El móvil de operación pasará automáticamente a <code>Z - FUERA DE OPERACION</code>.</li>
              <li>Se exige registro dual de motivos (GH y Operaciones) según la normativa interna.</li>
            </ul>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Motivo de Retiro - Gestión Humana <span className="text-red-500">*</span>
            </label>
            <select
              value={motivoGH}
              onChange={(e) => setMotivoGH(e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-red-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">Seleccione el motivo formal de GH...</option>
              {MOTIVOS_GH.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Motivo / Justificación Operativa <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={motivoOperaciones}
              onChange={(e) => setMotivoOperaciones(e.target.value)}
              placeholder="Detalle operativo de entrega de puesto, herramientas y paz y salvo..."
              required
              className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm uppercase text-gray-800 focus:border-red-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Fecha Efectiva de Retiro
            </label>
            <input
              type="date"
              value={fechaRetiro}
              onChange={(e) => setFechaRetiro(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-red-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus:outline-hidden disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Procesando egreso...</span>
                </>
              ) : (
                <>
                  <UserMinus className="h-4 w-4" />
                  <span>Confirmar Desactivación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
