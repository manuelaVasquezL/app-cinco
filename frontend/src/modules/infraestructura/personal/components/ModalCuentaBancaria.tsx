// src/modules/infraestructura/personal/components/ModalCuentaBancaria.tsx
"use client";

import React, { useState } from "react";
import { X, CreditCard, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EmpleadoPerfilCompleto } from "@/types/empleado";
import { personalService } from "../services/personalService";
import { usePersonalStore } from "../store/usePersonalStore";

interface Props {
  empleado: EmpleadoPerfilCompleto;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const BANCOS_COLOMBIA = [
  "BANCOLOMBIA",
  "BANCO DE BOGOTA",
  "DAVIVIENDA",
  "BANCO BBVA",
  "BANCO DE OCCIDENTE",
  "BANCO POPULAR",
  "BANCO CAJA SOCIAL",
  "BANCO AGRARIO",
  "NEQUI",
  "DAVIPLATA",
  "SCOTIABANK COLPATRIA",
  "BANCO AV VILLAS",
  "BANCO FALABELLA",
  "OTRO",
];

export const ModalCuentaBancaria: React.FC<Props> = ({
  empleado,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { fetchEmpleadoDetail } = usePersonalStore();
  const [banco, setBanco] = useState("DAVIVIENDA");
  const [tipoCuenta, setTipoCuenta] = useState("AHORROS");
  const [numeroCuenta, setNumeroCuenta] = useState("");
  const [esNomina, setEsNomina] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digitsOnly = numeroCuenta.replace(/\D/g, "");
    if (!digitsOnly || digitsOnly.length < 5) {
      toast.error("Ingrese un número de cuenta válido");
      return;
    }

    setIsSubmitting(true);
    try {
      await personalService.gestionarCuentaBancaria(empleado.id, {
        banco,
        tipo_cuenta: tipoCuenta,
        numero_cuenta: digitsOnly,
        es_nomina: esNomina,
      });

      toast.success("Cuenta bancaria registrada con normalización de 12 dígitos.");
      await fetchEmpleadoDetail(empleado.id);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar cuenta bancaria";
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
      <div className="relative my-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Gestionar Cuenta Bancaria
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {empleado.nombre_completo}
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

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-900 dark:border-indigo-800/40 dark:bg-indigo-950/40 dark:text-indigo-300">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
          <span>
            <strong>Regla Contable:</strong> El número de cuenta se normalizará a 12 dígitos rellenando con ceros a la izquierda según el estándar del archivo plano de dispersión de nómina.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Entidad Bancaria <span className="text-red-500">*</span>
            </label>
            <select
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-indigo-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              {BANCOS_COLOMBIA.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Tipo de Cuenta
            </label>
            <select
              value={tipoCuenta}
              onChange={(e) => setTipoCuenta(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-indigo-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="AHORROS">Ahorros</option>
              <option value="CORRIENTE">Corriente</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Número de Cuenta <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              maxLength={20}
              value={numeroCuenta}
              onChange={(e) => setNumeroCuenta(e.target.value)}
              placeholder="Ej: 1029384756"
              required
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 font-mono text-sm text-gray-800 focus:border-indigo-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="es_nomina"
              checked={esNomina}
              onChange={(e) => setEsNomina(e.target.checked)}
              className="h-4 w-4 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
            />
            <label htmlFor="es_nomina" className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
              Establecer como cuenta principal de nómina
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-hidden disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Normalizando...</span>
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  <span>Guardar Cuenta</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
