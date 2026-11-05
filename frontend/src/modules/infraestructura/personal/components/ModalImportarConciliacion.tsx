// src/modules/infraestructura/personal/components/ModalImportarConciliacion.tsx
"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Info,
  ShieldAlert,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import { personalService } from "../services/personalService";
import { ImportReporteResult } from "@/types/empleado";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tipo: "SSFF" | "SIIGO";
  onSuccess: () => void;
}

export const ModalImportarConciliacion: React.FC<Props> = ({
  isOpen,
  onClose,
  tipo,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ImportReporteResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const title = tipo === "SSFF" ? "Cargar Archivo SAP SuccessFactors (SSFF)" : "Cargar Archivo de Nómina SIIGO";
  const subtitle =
    tipo === "SSFF"
      ? "Sube el reporte exportado de SuccessFactors (.csv o .txt) para sincronizar colaboradores activos, actualizar códigos SAP (UserID) y marcar inactivos."
      : "Sube el reporte exportado de nómina SIIGO (.csv o .txt) para actualizar colaboradores, centros de costo, salarios y estados.";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg(null);
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setErrorMsg(null);
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg("Por favor selecciona un archivo CSV o TXT para procesar.");
      return;
    }

    try {
      setIsUploading(true);
      setErrorMsg(null);
      const res =
        tipo === "SSFF"
          ? await personalService.importarSSFF(file)
          : await personalService.importarSIIGO(file);

      setResult(res);
      onSuccess();
    } catch (err: any) {
      console.error("Error importando archivo:", err);
      const detail =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        "Ocurrió un error inesperado al procesar el archivo.";
      setErrorMsg(detail);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl border border-gray-200 dark:border-gray-800 transition-all">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                tipo === "SSFF"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
              }`}
            >
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form or Result View */}
        {!result ? (
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                file
                  ? "border-brand-500 bg-brand-50/40 dark:bg-brand-950/20"
                  : "border-gray-300 dark:border-gray-700 hover:border-brand-400 hover:bg-gray-50/50 dark:hover:bg-gray-800/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex flex-col items-center">
                <FileText
                  className={`w-12 h-12 mb-3 ${
                    file
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                />
                {file ? (
                  <>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {(file.size / 1024).toFixed(1)} KB — Clic para cambiar archivo
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Arrastra y suelta tu archivo aquí, o{" "}
                      <span className="text-brand-600 dark:text-brand-400 font-semibold underline">
                        explora tus archivos
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Archivos soportados: CSV o TXT delimitados por punto y coma (;), coma (,) o tabulación.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Legacy Format Hints */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3.5 border border-gray-200 dark:border-gray-700/60 text-xs text-gray-600 dark:text-gray-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200">
                <Info className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                <span>Estructura esperada del reporte:</span>
              </div>
              {tipo === "SSFF" ? (
                <ul className="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400 pl-1">
                  <li>
                    Columnas requeridas: <code className="text-brand-600 dark:text-brand-300 font-mono">Cédula (o Cédula de Ciudadanía)</code>, <code className="text-brand-600 dark:text-brand-300 font-mono">Status</code>, <code className="text-brand-600 dark:text-brand-300 font-mono">UserID</code>, <code className="text-brand-600 dark:text-brand-300 font-mono">Nombres</code>, <code className="text-brand-600 dark:text-brand-300 font-mono">Apellidos</code>.
                  </li>
                  <li>
                    Si el colaborador existe en CINCO, su Código SAP (UserID) se sincronizará automáticamente.
                  </li>
                  <li>
                    Los registros ausentes en el archivo pasarán al estado <strong className="text-red-600">DELETE</strong>.
                  </li>
                </ul>
              ) : (
                <ul className="list-disc list-inside space-y-0.5 text-gray-500 dark:text-gray-400 pl-1">
                  <li>
                    Columnas requeridas: <code className="text-brand-600 dark:text-brand-300 font-mono">NIT</code>, <code className="text-brand-600 dark:text-brand-300 font-mono">Nombre del Empleado</code>, <code className="text-brand-600 dark:text-brand-300 font-mono">Centro de Costo</code>, <code className="text-brand-600 dark:text-brand-300 font-mono">Sueldo</code>.
                  </li>
                  <li>
                    Sincroniza salario y centro de costos. Los registros no incluidos pasarán al estado <strong className="text-amber-600">INACTIVO</strong>.
                  </li>
                </ul>
              )}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-3 text-xs text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Error al procesar:</p>
                  <p>{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isUploading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!file || isUploading}
                className="flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Procesando archivo...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Cargar e Importar</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          /* Result Summary View */
          <div className="mt-5 space-y-5">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>{result.msg || "¡Reporte procesado exitosamente!"}</span>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                  Total Leídos
                </span>
                <span className="text-xl font-bold text-gray-900 dark:text-white mt-1 block">
                  {result.total_registros}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/40">
                <span className="text-[11px] font-medium text-green-700 dark:text-green-300 uppercase tracking-wider block">
                  Nuevos Creados
                </span>
                <span className="text-xl font-bold text-green-700 dark:text-green-300 mt-1 block">
                  {result.cnt_insertados}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40">
                <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                  Actualizados
                </span>
                <span className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-1 block">
                  {result.cnt_actualizados}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40">
                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                  Desactivados
                </span>
                <span className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1 block">
                  {result.cnt_desactivados}
                </span>
              </div>
            </div>

            {tipo === "SSFF" && result.cnt_sap_actualizados !== undefined && (
              <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 p-3 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
                <span className="font-medium">
                  Códigos SAP sincronizados en ficha del colaborador:
                </span>
                <span className="font-bold text-sm bg-indigo-200 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                  {result.cnt_sap_actualizados}
                </span>
              </div>
            )}

            {/* Scientific Notation / Error Warnings */}
            {result.cedulas_con_error && result.cedulas_con_error.length > 0 && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-semibold text-xs">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    Advertencia: Se omitieron {result.cedulas_con_error.length} filas con notación científica de Excel
                  </span>
                </div>
                <p className="text-[11px] text-red-700 dark:text-red-300">
                  Excel formateó estas cédulas como exponencial (ej. <code className="bg-red-100 dark:bg-red-900/50 px-1 rounded font-mono">1.01E+09</code>). Corrígelas configurando la columna como Texto en Excel y vuelve a exportar:
                </p>
                <div className="max-h-36 overflow-y-auto border border-red-200 dark:border-red-900/40 rounded-lg bg-white dark:bg-gray-900">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-red-100/60 dark:bg-red-950/60 text-red-900 dark:text-red-200">
                      <tr>
                        <th className="py-1 px-3">Fila</th>
                        <th className="py-1 px-3">Valor Cédula</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {result.cedulas_con_error.map((errItem, idx) => (
                        <tr key={idx} className="text-gray-700 dark:text-gray-300">
                          <td className="py-1 px-3 font-medium">#{errItem.fila}</td>
                          <td className="py-1 px-3 font-mono text-red-600 dark:text-red-400">
                            {errItem.cedula}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="text-xs"
              >
                Cargar otro archivo
              </Button>
              <Button type="button" onClick={onClose} className="text-xs">
                Aceptar y Finalizar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

