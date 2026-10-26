"use client";

import React from "react";

export const TIPOS_VIA = [
  { value: "CL", label: "CL - Calle" },
  { value: "CRA", label: "CRA - Carrera" },
  { value: "AV", label: "AV - Avenida" },
  { value: "DG", label: "DG - Diagonal" },
  { value: "TV", label: "TV - Transversal" },
  { value: "CC", label: "CC - Circular" },
  { value: "AUT", label: "AUT - Autopista" },
  { value: "OTRO", label: "Otro / Libre" },
];

/**
 * Parsea un string de dirección almacenado (ej: "CL 21C" o "AV 45")
 * separando el tipo de vía y el número/letra restante.
 */
export const parsearCalle = (calle: string) => {
  if (!calle) {
    return { tipoVia: "CL", numeroVia: "", nombreCalleLibre: "" };
  }
  const match = TIPOS_VIA.find(
    (tv) => tv.value !== "OTRO" && calle.startsWith(tv.value + " ")
  );
  if (match) {
    return {
      tipoVia: match.value,
      numeroVia: calle.substring(match.value.length + 1).trim(),
      nombreCalleLibre: "",
    };
  }
  return {
    tipoVia: "OTRO",
    numeroVia: "",
    nombreCalleLibre: calle.trim(),
  };
};

/**
 * Compone el texto unificado de la calle a partir del tipo de vía y su número.
 * Si es tipo estándar pero no hay número escrito, devuelve vacío "" para evitar datos basura como "CL".
 */
export const componerCalle = (
  tipoVia: string,
  numeroVia: string,
  nombreCalleLibre: string
): string => {
  if (tipoVia === "OTRO") {
    return nombreCalleLibre.trim().toUpperCase();
  }
  const num = numeroVia.trim().toUpperCase();
  return num ? `${tipoVia} ${num}` : "";
};

export interface DireccionCamposGroupProps {
  tipoVia: string;
  onTipoViaChange: (val: string) => void;
  numeroVia: string;
  onNumeroViaChange: (val: string) => void;
  nombreCalleLibre: string;
  onNombreCalleLibreChange: (val: string) => void;
  placa: string;
  onPlacaChange: (val: string) => void;
  interior?: string;
  onInteriorChange?: (val: string) => void;
  mostrarInterior?: boolean;
  esObligatoria?: boolean;
  mostrarVistaPrevia?: boolean;
  labelVia?: string;
  labelPlaca?: string;
}

export const DireccionCamposGroup: React.FC<DireccionCamposGroupProps> = ({
  tipoVia,
  onTipoViaChange,
  numeroVia,
  onNumeroViaChange,
  nombreCalleLibre,
  onNombreCalleLibreChange,
  placa,
  onPlacaChange,
  interior = "",
  onInteriorChange,
  mostrarInterior = false,
  esObligatoria = false,
  mostrarVistaPrevia = true,
  labelVia,
  labelPlaca,
}) => {
  const placaLimpia = placa.trim();
  const tieneDatos = Boolean(
    (tipoVia === "OTRO" ? nombreCalleLibre.trim() : numeroVia.trim()) ||
    placaLimpia ||
    (mostrarInterior && interior.trim())
  );

  // Formateo de la vía para vista previa
  const viaPreview =
    tipoVia === "OTRO"
      ? nombreCalleLibre.trim().toUpperCase() || "(vía libre)"
      : numeroVia.trim()
      ? `${tipoVia} ${numeroVia.trim().toUpperCase()}`
      : `${tipoVia} (vía)`;

  // Formateo de la placa para vista previa
  const placaPreview = placaLimpia ? `#${placaLimpia}` : "#(placa)";

  // Interior opcional
  const interiorPreview =
    mostrarInterior && interior.trim() ? ` Int. ${interior.trim().toUpperCase()}` : "";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        {/* Tipo de Vía */}
        <div className={mostrarInterior ? "sm:col-span-3" : "sm:col-span-4"}>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Tipo de Vía {esObligatoria && <span className="text-red-500">*</span>}
          </label>
          <select
            value={tipoVia}
            onChange={(e) => onTipoViaChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            {TIPOS_VIA.map((tv) => (
              <option key={tv.value} value={tv.value}>
                {tv.label}
              </option>
            ))}
          </select>
        </div>

        {/* Número / Nombre de la Vía */}
        <div className={mostrarInterior ? "sm:col-span-4" : "sm:col-span-4"}>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {labelVia || (tipoVia === "OTRO" ? "Dirección / Vía Completa" : "Número / Letra de la Vía")}{" "}
            {esObligatoria && <span className="text-red-500">*</span>}
          </label>
          {tipoVia === "OTRO" ? (
            <input
              type="text"
              value={nombreCalleLibre}
              onChange={(e) => onNombreCalleLibreChange(e.target.value.toUpperCase())}
              placeholder="Ej: CALLE 21C, VEREDA EL SALADO"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          ) : (
            <input
              type="text"
              value={numeroVia}
              onChange={(e) => onNumeroViaChange(e.target.value.toUpperCase())}
              placeholder="Ej: 21C, 45B, 80"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          )}
        </div>

        {/* Placa Puerta (PLACAUNIDA) */}
        <div className={mostrarInterior ? "sm:col-span-3" : "sm:col-span-4"}>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {labelPlaca || "Placa / Número"} {esObligatoria && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={placa}
            onChange={(e) => onPlacaChange(e.target.value.toUpperCase())}
            placeholder="Ej: 40A-15, 12-34"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold uppercase placeholder:normal-case focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Interior / Torre */}
        {mostrarInterior && (
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Interior / Torre (INT)
            </label>
            <input
              type="text"
              value={interior}
              onChange={(e) => onInteriorChange?.(e.target.value.toUpperCase())}
              placeholder="Ej: 6, T1, BL-2"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Vista previa en vivo */}
      {mostrarVistaPrevia && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">Vista previa:</span>
          <span
            className={`font-semibold ${
              tieneDatos
                ? "text-brand-600 dark:text-brand-400"
                : "text-gray-400 dark:text-gray-500"
            }`}
          >
            {viaPreview} {placaPreview}
            {interiorPreview}
          </span>
          {!tieneDatos && !esObligatoria && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500 italic">
              (Opcional)
            </span>
          )}
        </div>
      )}
    </div>
  );
};
