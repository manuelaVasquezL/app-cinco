// src/modules/infraestructura/personal/components/ModalRestablecerContrasena.tsx
"use client";

import React, { useState } from "react";
import { KeyRound, X, Loader2, Copy, Check, ShieldAlert, CheckCircle2 } from "lucide-react";
import { personalService, RestablecerContrasenaResponse } from "../services/personalService";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  empleadoId: number;
  nombreEmpleado: string;
  documentoEmpleado: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ModalRestablecerContrasena: React.FC<Props> = ({
  isOpen,
  empleadoId,
  nombreEmpleado,
  documentoEmpleado,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [resultado, setResultado] = useState<RestablecerContrasenaResponse | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Reiniciar estado al cerrar
  const handleClose = () => {
    if (isLoading) return;
    setResultado(null);
    setCopiado(false);
    onClose();
  };

  const handleRestablecer = async () => {
    setIsLoading(true);
    try {
      const data = await personalService.restablecerContrasena(empleadoId);
      setResultado(data);
      toast.success(data.mensaje || "Contraseña temporal generada exitosamente.");
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        "Error al intentar restablecer la contraseña del colaborador.";
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopiar = async () => {
    if (!resultado) return;
    const textoCredenciales = `Usuario: ${resultado.username}\nContraseña Temporal: ${resultado.temp_password}`;
    try {
      await navigator.clipboard.writeText(textoCredenciales);
      setCopiado(true);
      toast.success("Credenciales copiadas al portapapeles.");
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("No se pudo copiar automáticamente al portapapeles.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:items-center sm:p-4 overflow-y-auto animate-fade-in">
      {/* Overlay con fondo claro difuminado idéntico a los demás modales */}
      <div
        className="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px] dark:bg-black/60 cursor-pointer"
        onClick={isLoading ? undefined : handleClose}
        aria-hidden="true"
      />

      <div
        className="relative my-auto w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          onClick={handleClose}
          disabled={isLoading}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 disabled:opacity-50 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {!resultado ? (
          /* ESTADO 1: CONFIRMACIÓN PREVIA */
          <div>
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Restablecer Contraseña
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {nombreEmpleado} • CC {documentoEmpleado}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-relaxed">
                ¿Deseas generar una nueva contraseña temporal de acceso para este colaborador?
              </p>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                La contraseña anterior quedará invalidada de inmediato y la acción se registrará obligatoriamente en la auditoría del sistema (Habeas Data).
              </p>
            </div>

            {/* Alerta de seguridad */}
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>Seguridad:</strong> Esta función está protegida por políticas corporativas. Entrega la clave temporal de forma directa y segura únicamente al titular de la cuenta.
              </span>
            </div>

            {/* Botones de acción */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/60 disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRestablecer}
                disabled={isLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-amber-500 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Generando contraseña...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Generar Contraseña</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ESTADO 2: CLAVE GENERADA CON ATAJO DE COPIADO */
          <div>
            {/* Header unificado estado exitoso */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Contraseña Temporal Generada
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {nombreEmpleado} • CC {documentoEmpleado}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-relaxed">
                La nueva contraseña temporal ha sido activada exitosamente.
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Copia y entrega estas credenciales al colaborador para que inicie sesión y configure su clave definitiva:
              </p>
            </div>

            {/* Tarjeta de credenciales */}
            <div className="mt-4 rounded-2xl border border-brand-200/80 bg-brand-50/40 p-4 dark:border-brand-900/40 dark:bg-brand-950/20 space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Usuario de Acceso
                </span>
                <p className="font-mono text-sm font-bold text-gray-900 dark:text-white mt-0.5 select-all">
                  {resultado.username}
                </p>
              </div>

              <div className="pt-2.5 border-t border-brand-200/50 dark:border-brand-900/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Contraseña Temporal
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                    Activa
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3 bg-white dark:bg-gray-900 border border-brand-300/80 dark:border-brand-700/60 rounded-xl px-3.5 py-2.5">
                  <span className="font-mono text-base font-bold tracking-wider text-brand-700 dark:text-brand-300 select-all">
                    {resultado.temp_password}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopiar}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
                    title="Copiar contraseña"
                  >
                    {copiado ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCopiar}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-4 text-xs font-semibold text-brand-700 shadow-2xs hover:bg-brand-50 dark:border-brand-800 dark:bg-gray-800 dark:text-brand-300 dark:hover:bg-brand-950/40 cursor-pointer transition-colors"
              >
                {copiado ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Credenciales Copiadas</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copiar Credenciales</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="h-10 rounded-xl bg-gray-900 px-5 text-xs font-semibold text-white shadow-xs hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 cursor-pointer transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
