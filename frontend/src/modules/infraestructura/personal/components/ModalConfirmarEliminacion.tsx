// src/modules/infraestructura/personal/components/ModalConfirmarEliminacion.tsx
"use client";

import React from "react";
import { Trash2, X, Loader2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  titulo?: string;
  mensaje: string;
  nombreElemento?: string;
  detalle?: string;
  textoBotonConfirmar?: string;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ModalConfirmarEliminacion: React.FC<Props> = ({
  isOpen,
  titulo = "Confirmar Eliminación",
  mensaje,
  nombreElemento,
  detalle,
  textoBotonConfirmar = "Eliminar",
  isLoading = false,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      {/* Fondo difuminado con backdrop blur */}
      <div
        className="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px] dark:bg-black/60 cursor-pointer"
        onClick={isLoading ? undefined : onClose}
        aria-hidden="true"
      />

      <div className="relative my-auto w-full max-w-sm rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900 text-center">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Ícono de eliminación */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400 ring-8 ring-red-50/50 dark:ring-red-500/5 mb-4">
          <Trash2 className="h-7 w-7" />
        </div>

        {/* Título */}
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          {titulo}
        </h3>

        {/* Mensaje */}
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          {mensaje}
        </p>

        {/* Elemento a eliminar */}
        {nombreElemento && (
          <div className="mt-3.5 rounded-xl border border-red-100 bg-red-50/50 px-3.5 py-2.5 dark:border-red-900/30 dark:bg-red-950/20 text-left">
            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
              {nombreElemento}
            </p>
            {detalle && (
              <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mt-0.5">
                {detalle}
              </p>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-10 rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/60 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-red-500 focus:outline-hidden disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Eliminando...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>{textoBotonConfirmar}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

