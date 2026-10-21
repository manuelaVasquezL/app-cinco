"use client";

import React, { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Eye, UserCheck, Calendar } from "lucide-react";
import { CuadraCheckResult } from "../types";

interface AlertaCuadraBannerProps {
  checkResult: CuadraCheckResult | null;
  isLoading: boolean;
  onIgnorar?: () => void;
}

export const AlertaCuadraBanner: React.FC<AlertaCuadraBannerProps> = ({
  checkResult,
  isLoading,
  onIgnorar,
}) => {
  const [expandido, setExpandido] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/70 p-3 text-xs text-brand-700 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <span>Verificando si este sector o plancha ya tiene levantamiento previo...</span>
      </div>
    );
  }

  if (!checkResult || !checkResult.tiene_registros) {
    return null;
  }

  const fechaFormateada = checkResult.ultimo_registro_fecha
    ? new Date(checkResult.ultimo_registro_fecha).toLocaleString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Sin fecha";

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm dark:border-amber-700 dark:bg-amber-950/50">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-amber-900 dark:text-amber-200">
              ¡Atención! Esta cuadra / plancha ya tiene levantamiento registrado
            </h4>
            <span className="inline-flex items-center rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-800 dark:text-amber-100">
              {checkResult.total_predios} predios registrados
            </span>
          </div>

          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            {checkResult.mensaje}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-amber-700 dark:text-amber-400">
            {checkResult.ultimo_recolector && (
              <span className="flex items-center gap-1 font-medium">
                <UserCheck className="h-3.5 w-3.5 text-amber-600" />
                Registrado por: <strong>{checkResult.ultimo_recolector}</strong>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-amber-600" />
              Último registro: <strong>{fechaFormateada}</strong>
            </span>
          </div>

          {/* Botones de acción rápida */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setExpandido(!expandido)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 shadow-xs hover:bg-amber-100 transition-colors dark:border-amber-600 dark:bg-gray-800 dark:text-amber-200 dark:hover:bg-gray-700"
            >
              <Eye className="h-3.5 w-3.5" />
              {expandido ? "Ocultar predios registrados" : "Ver predios ya registrados en esta cuadra"}
              {expandido ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {onIgnorar && (
              <button
                type="button"
                onClick={onIgnorar}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-amber-800 hover:text-amber-950 underline dark:text-amber-300"
              >
                Es una nueva casa en esta cuadra (Continuar)
              </button>
            )}
          </div>

          {/* Desplegable con los predios registrados previamente */}
          {expandido && checkResult.predios_recientes?.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-lg border border-amber-200 bg-white/90 text-xs shadow-inner dark:border-amber-900 dark:bg-gray-900">
              <div className="bg-amber-100/70 px-3 py-1.5 font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
                Últimos predios censados en este sector:
              </div>
              <ul className="divide-y divide-amber-100 dark:divide-gray-800 max-h-48 overflow-y-auto">
                {checkResult.predios_recientes.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-2 hover:bg-amber-50/50 dark:hover:bg-gray-800/50">
                    <div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {p.nombre_calle} #{p.placa_unidad}
                      </span>
                      {p.interior && <span className="ml-1 text-gray-500">Int. {p.interior}</span>}
                      {p.nombre_conjunto && (
                        <span className="ml-2 italic text-gray-500 dark:text-gray-400">
                          ({p.nombre_conjunto})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <span>{p.total_unidades} unidades</span>
                      <span>•</span>
                      <span>AMP: {p.lote_amp}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
