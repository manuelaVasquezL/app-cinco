// src/modules/infraestructura/personal/components/ModalAsignarPlaca.tsx
"use client";

import React, { useState } from "react";
import { X, Car, ShieldAlert, Loader2 } from "lucide-react";
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

export const ModalAsignarPlaca: React.FC<Props> = ({
  empleado,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { updateLocalItem, fetchEmpleadoDetail } = usePersonalStore();
  const mov = "movilidad" in empleado ? empleado.movilidad : undefined;
  const initialPlaca = empleado.placa_vehiculo || mov?.placa_vehiculo || "";
  const initialSabeConducir = mov?.sabe_conducir ?? true;
  const initialMedio = mov?.medio_transporte || "MOTO";
  const initialModelo = mov?.modelo_vehiculo || "";

  const [placa, setPlaca] = useState(initialPlaca);
  const [sabeConducir, setSabeConducir] = useState<boolean>(initialSabeConducir);
  const [medioTransporte, setMedioTransporte] = useState<string>(initialMedio);
  const [modeloVehiculo, setModeloVehiculo] = useState<string>(initialModelo);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlaca = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!cleanPlaca || cleanPlaca.length < 5) {
      toast.error("Ingrese una placa válida (ej. ABC123 o WXY45E)");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await personalService.asignarPlaca(empleado.id, {
        placa: cleanPlaca,
        sabe_conducir: sabeConducir,
        conduce: sabeConducir,
        medio_transporte: medioTransporte,
        modelo_vehiculo: modeloVehiculo.trim(),
      });

      toast.success(res?.msg || `Vehículo con placa ${cleanPlaca} asignado a ${empleado.nombre_completo}`);
      if (res?.placa_vehiculo) {
        updateLocalItem({
          ...empleado,
          placa_vehiculo: res.placa_vehiculo,
          movilidad: res.movilidad || {
            ...(mov || {}),
            sabe_conducir: sabeConducir,
            medio_transporte: medioTransporte,
            modelo_vehiculo: modeloVehiculo.trim(),
            placa_vehiculo: res.placa_vehiculo,
          },
        } as any);
      }
      if (fetchEmpleadoDetail) {
        await fetchEmpleadoDetail(empleado.id);
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al asignar vehículo";
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Asignación Vehicular y Movilidad
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

        {/* Alert Rule */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Regla de Exclusividad:</strong> Una placa solo puede estar asignada a un colaborador a la vez. Si la placa ingresada se encuentra asignada a otro empleado, el sistema la reasignará atómicamente y registrará la liberación en la auditoría.
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Placa del Vehículo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={8}
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                placeholder="Ej: ABC123"
                required
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 font-mono text-sm tracking-wider uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Medio de Transporte
              </label>
              <select
                value={medioTransporte}
                onChange={(e) => setMedioTransporte(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="MOTO">MOTO - Motocicleta</option>
                <option value="CARRO">CARRO - Automóvil / Camioneta</option>
                <option value="TRANSPORTE_PUBLICO">TRANSPORTE PÚBLICO</option>
                <option value="A_PIE">A PIE - Peatonal</option>
                <option value="NINGUNO">NINGUNO</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Modelo / Línea del Vehículo
            </label>
            <input
              type="text"
              value={modeloVehiculo}
              onChange={(e) => setModeloVehiculo(e.target.value)}
              placeholder="Ej: Yamaha XTZ 150 / Renault Duster 2022"
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-800/40">
            <input
              type="checkbox"
              id="modal_sabe_conducir"
              checked={sabeConducir}
              onChange={(e) => setSabeConducir(e.target.checked)}
              className="h-4 w-4 rounded-sm border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800"
            />
            <label htmlFor="modal_sabe_conducir" className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
              ¿El colaborador posee habilidad comprobada de conducción? (sabe_conducir)
            </label>
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 focus:outline-hidden disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Validando exclusividad...</span>
                </>
              ) : (
                <>
                  <Car className="h-4 w-4" />
                  <span>Asignar Placa</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
