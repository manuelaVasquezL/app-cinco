"use client";

import React from "react";
import { Info, CheckCircle2 } from "lucide-react";
import { DireccionCheckResult } from "../types";

interface AlertaDireccionFlotanteProps {
  checkResult: DireccionCheckResult | null;
  onConfirmarNuevaUnidad?: () => void;
}

export const AlertaDireccionFlotante: React.FC<AlertaDireccionFlotanteProps> = ({
  checkResult,
  onConfirmarNuevaUnidad,
}) => {
  if (!checkResult || !checkResult.existe_exacta) {
    return null;
  }

  const primeraCoincidencia = checkResult.coincidencias?.[0];

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50/80 p-3 text-xs text-brand-900 shadow-xs dark:border-brand-900/50 dark:bg-brand-950/40 dark:text-brand-200">
      <div className="flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-brand-950 dark:text-brand-100">
            Dirección previamente registrada ({checkResult.total_coincidencias} coincidencia{checkResult.total_coincidencias > 1 ? "s" : ""})
          </p>
          {primeraCoincidencia && (
            <p className="mt-0.5 text-brand-800 dark:text-brand-300">
              Registrado como: <strong>{primeraCoincidencia.nombre_conjunto || primeraCoincidencia.direccion_completa}</strong> ({primeraCoincidencia.barrio} - Plancha {primeraCoincidencia.lote_amp}).
            </p>
          )}
          <p className="mt-1 text-[11px] text-brand-700 dark:text-brand-400">
            💡 <strong>Sin bloqueos:</strong> Si corresponde a otra torre, interior o adición de esta dirección, puedes continuar y guardar normalmente.
          </p>
        </div>
      </div>
    </div>
  );
};
