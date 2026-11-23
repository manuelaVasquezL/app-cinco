"use client";

import React, { useRef } from "react";
import { X } from "lucide-react";

export interface PlantillaConfig {
  nombreArchivo: string;
  contenido: string;
  textoBoton?: string;
}

export interface ModalImportarBaseProps {
  isOpen: boolean;
  onClose: () => void;
  titulo: string;
  subtitulo?: string;
  icono?: React.ReactNode;

  // Zona de Instrucciones & Descarga de Plantilla
  tituloInstrucciones?: string;
  instrucciones?: React.ReactNode;
  plantillaConfig?: PlantillaConfig;
  onDescargarPlantilla?: () => void;

  // Zona de Carga de Archivo
  file: File | null;
  onFileSelect: (file: File | null) => void;
  accept?: string;
  textoDropzone?: string;
  textoDropzoneCargado?: string;
  ayudaFormatos?: string;

  // Estados
  isProcessing?: boolean;

  // Contenido Adicional (Previsualización, KPIs de Resumen, Alertas de Error)
  children?: React.ReactNode;

  // Botones de Acción en el Pie
  footerActions?: React.ReactNode;
}

/**
 * ModalImportarBase
 *
 * Cascarón visual estandarizado para modales de importación de archivos CSV / TXT / Excel
 * basado en el diseño y experiencia de usuario de Gestión de Actividades (Operaciones).
 */
export const ModalImportarBase: React.FC<ModalImportarBaseProps> = ({
  isOpen,
  onClose,
  titulo,
  subtitulo,
  icono,
  tituloInstrucciones = "¿Cómo importar tus datos?",
  instrucciones,
  plantillaConfig,
  onDescargarPlantilla,
  file,
  onFileSelect,
  accept = ".csv,.txt",
  textoDropzone = "Selecciona o arrastra tu archivo CSV",
  textoDropzoneCargado = "Clic para cambiar archivo",
  ayudaFormatos = "Archivos soportados: .csv o .txt",
  isProcessing = false,
  children,
  footerActions,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDescargarPlantillaInterna = () => {
    if (onDescargarPlantilla) {
      onDescargarPlantilla();
      return;
    }

    if (plantillaConfig) {
      const blob = new Blob([plantillaConfig.contenido], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", plantillaConfig.nombreArchivo);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isProcessing) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:items-center sm:p-4 overflow-y-auto animate-fade-in">
      {/* Overlay con fondo claro difuminado idéntico a Operaciones */}
      <div
        className="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px] dark:bg-black/60 cursor-pointer transition-opacity"
        onClick={() => !isProcessing && onClose()}
        aria-hidden="true"
      />

      {/* Caja del Modal */}
      <div className="relative my-auto w-full max-w-4xl max-h-[88vh] flex flex-col bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {icono || (
                <svg
                  className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
              )}
              <span>{titulo}</span>
            </h2>
            {subtitulo && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {subtitulo}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Cerrar modal"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo con Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tarjeta de Instrucciones y Descarga de Plantilla (si aplica) */}
          {(instrucciones || plantillaConfig || onDescargarPlantilla) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-gray-50/70 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-200/60 dark:border-gray-800">
              <div className="md:col-span-2 space-y-2">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {tituloInstrucciones}
                </h3>
                {typeof instrucciones === "string" ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {instrucciones}
                  </p>
                ) : (
                  instrucciones
                )}
              </div>

              {(plantillaConfig || onDescargarPlantilla) && (
                <div className="flex justify-start md:justify-end">
                  <button
                    type="button"
                    onClick={handleDescargarPlantillaInterna}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 rounded-xl transition-all shadow-md hover:shadow-indigo-500/20 active:scale-95 cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    <span>
                      {plantillaConfig?.textoBoton || "Descargar Plantilla CSV"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Zona de Drop / Selección de Archivo */}
          <div
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
              file
                ? "border-emerald-400/80 bg-emerald-50/30 dark:bg-emerald-950/20"
                : "border-gray-300 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-gray-50/30 hover:bg-indigo-50/10 dark:hover:bg-indigo-950/10"
            } ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={accept}
              disabled={isProcessing}
              className="hidden"
            />

            <div
              className={`p-4 rounded-full mb-3 ${
                file
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                  : "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
              }`}
            >
              {file ? (
                <svg
                  className="w-8 h-8 animate-bounce"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              )}
            </div>

            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 text-center">
              {file ? file.name : textoDropzone}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-center">
              {file
                ? `${(file.size / 1024).toFixed(1)} KB — ${textoDropzoneCargado}`
                : ayudaFormatos}
            </p>
          </div>

          {/* Contenido adicional (hijos: previsualización, KPIs, mensajes, etc.) */}
          {children}
        </div>

        {/* Pie del Modal */}
        {footerActions && (
          <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 flex justify-end gap-3 shrink-0">
            {footerActions}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalImportarBase;

