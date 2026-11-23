// src/modules/infraestructura/personal/components/ModalImportarConciliacion.tsx
"use client";

import React, { useState } from "react";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { ModalImportarBase, PlantillaConfig } from "@/components/ui/modal/ModalImportarBase";
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

  if (!isOpen) return null;

  const title =
    tipo === "SSFF"
      ? "Cargar Archivo SAP SuccessFactors (SSFF)"
      : "Cargar Archivo de Nómina SIIGO";

  const subtitle =
    tipo === "SSFF"
      ? "Sincroniza colaboradores activos, actualiza códigos SAP (UserID) y concilia novedades con la base de personal."
      : "Sincroniza salarios, centros de costo y concilia el estado de la nómina SIIGO con la base de personal.";

  // Plantillas CSV de ejemplo descargables
  const plantillaSSFF: PlantillaConfig = {
    nombreArchivo: "plantilla_ssff_sap.csv",
    textoBoton: "Descargar Plantilla SSFF",
    contenido: [
      "Cédula,UserID,Nombres,Apellidos,Status",
      "1055837370,SAP10023,Carlos Andrés,Pérez Gómez,Active",
      "1037654321,SAP10024,Laura María,Rodríguez Silva,Active",
      "98765432,SAP10025,Juan Camilo,Hernández Restrepo,Inactive",
    ].join("\n"),
  };

  const plantillaSIIGO: PlantillaConfig = {
    nombreArchivo: "plantilla_nomina_siigo.csv",
    textoBoton: "Descargar Plantilla SIIGO",
    contenido: [
      "NIT,Nombre del Empleado,Centro de Costo,Sueldo",
      "1055837370,Carlos Andrés Pérez Gómez,REDES_MEDELLIN,2500000",
      "1037654321,Laura María Rodríguez Silva,ADMINISTRACION,3200000",
      "98765432,Juan Camilo Hernández Restrepo,OPERACIONES_BOGOTA,1800000",
    ].join("\n"),
  };

  const instrucciones = (
    <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-disc pl-4">
      {tipo === "SSFF" ? (
        <>
          <li>
            Descarga la plantilla CSV con la estructura oficial requerida por{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              SAP SuccessFactors
            </span>
            .
          </li>
          <li>
            Columnas obligatorias:{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              Cédula, Status, UserID, Nombres y Apellidos
            </span>
            .
          </li>
          <li>
            Si el colaborador ya existe en CINCO, su Código SAP (UserID) se sincronizará automáticamente.
          </li>
          <li>
            Los colaboradores no incluidos en el reporte pasarán al estado{" "}
            <strong className="text-red-600 dark:text-red-400 font-semibold">DELETE</strong>.
          </li>
        </>
      ) : (
        <>
          <li>
            Descarga la plantilla CSV con la estructura oficial requerida por{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              Nómina SIIGO
            </span>
            .
          </li>
          <li>
            Columnas obligatorias:{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              NIT, Nombre del Empleado, Centro de Costo y Sueldo
            </span>
            .
          </li>
          <li>
            Actualiza el salario base y el centro de costos de cada colaborador activo.
          </li>
          <li>
            Los colaboradores omitidos en el archivo pasarán al estado{" "}
            <strong className="text-amber-600 dark:text-amber-400 font-semibold">INACTIVO</strong>.
          </li>
        </>
      )}
    </ul>
  );

  const handleSubmit = async () => {
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
  };

  const iconoHeader = (
    <div
      className={`p-2 rounded-xl ${
        tipo === "SSFF"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
          : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
      }`}
    >
      <UploadCloud className="w-5 h-5" />
    </div>
  );

  const footerActions = !result ? (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={isUploading}
        className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 active:scale-95 transition-all duration-200 disabled:opacity-50 cursor-pointer"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!file || isUploading}
        className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:dark:bg-gray-800 disabled:text-gray-400 disabled:dark:text-gray-600 disabled:shadow-none disabled:cursor-not-allowed rounded-xl transition-all shadow-md hover:shadow-indigo-500/25 active:scale-95 cursor-pointer"
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
      </button>
    </>
  ) : (
    <>
      <button
        type="button"
        onClick={handleReset}
        className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 active:scale-95 transition-all duration-200 cursor-pointer"
      >
        Cargar otro archivo
      </button>
      <button
        type="button"
        onClick={onClose}
        className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md hover:shadow-indigo-500/25 active:scale-95 cursor-pointer"
      >
        Aceptar y Finalizar
      </button>
    </>
  );

  return (
    <ModalImportarBase
      isOpen={isOpen}
      onClose={onClose}
      titulo={title}
      subtitulo={subtitle}
      icono={iconoHeader}
      tituloInstrucciones="¿Cómo importar tus datos?"
      instrucciones={!result ? instrucciones : undefined}
      plantillaConfig={!result ? (tipo === "SSFF" ? plantillaSSFF : plantillaSIIGO) : undefined}
      file={file}
      onFileSelect={(f) => {
        setFile(f);
        setErrorMsg(null);
        setResult(null);
      }}
      accept=".csv,.txt"
      textoDropzone="Selecciona o arrastra tu archivo CSV o TXT"
      ayudaFormatos="Archivos soportados: .csv o .txt delimitados por comas (,), punto y coma (;) o tabulaciones"
      isProcessing={isUploading}
      footerActions={footerActions}
    >
      {/* Mensaje de Error si ocurre durante la subida */}
      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-4 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-sm">Error al procesar el archivo:</p>
            <p className="leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Vista de Resultados Consolidada (KPIs y Advertencias) */}
      {result && (
        <div className="space-y-6 pt-2">
          {/* Banner de Éxito */}
          <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{result.msg || "¡Reporte procesado exitosamente!"}</span>
          </div>

          {/* Tarjetas KPI de Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-700/60 shadow-xs">
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                Total Leídos
              </span>
              <span className="text-2xl font-black text-gray-900 dark:text-white mt-1.5 block">
                {result.total_registros}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                Nuevos Creados
              </span>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1.5 block">
                {result.cnt_insertados}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 shadow-xs">
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
                Actualizados
              </span>
              <span className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1.5 block">
                {result.cnt_actualizados}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                Desactivados
              </span>
              <span className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1.5 block">
                {result.cnt_desactivados}
              </span>
            </div>
          </div>

          {/* Banner especial para SAP SuccessFactors */}
          {tipo === "SSFF" && result.cnt_sap_actualizados !== undefined && (
            <div className="rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/50 p-4 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 shadow-xs">
              <span className="font-semibold text-sm">
                Códigos SAP sincronizados en ficha del colaborador:
              </span>
              <span className="font-black text-base bg-indigo-200/80 dark:bg-indigo-900/80 text-indigo-900 dark:text-indigo-100 px-3 py-1 rounded-xl">
                {result.cnt_sap_actualizados}
              </span>
            </div>
          )}

          {/* Tabla de Advertencia por Cédulas con Notación Científica en Excel */}
          {result.cedulas_con_error && result.cedulas_con_error.length > 0 && (
            <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-bold text-xs">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                <span>
                  Advertencia: Se omitieron {result.cedulas_con_error.length} filas con notación científica de Excel
                </span>
              </div>
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                Excel formateó estas cédulas como exponencial (ej.{" "}
                <code className="bg-red-100 dark:bg-red-900/60 px-1.5 py-0.5 rounded font-mono text-[11px]">
                  1.01E+09
                </code>
                ). Corrígelas configurando la columna como Texto en Excel y vuelve a exportar:
              </p>
              <div className="max-h-40 overflow-y-auto border border-red-200 dark:border-red-900/40 rounded-xl bg-white dark:bg-gray-900">
                <table className="w-full text-left text-xs">
                  <thead className="bg-red-100/70 dark:bg-red-950/60 text-red-900 dark:text-red-200 sticky top-0 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-4 w-24">Fila</th>
                      <th className="py-2 px-4">Valor Cédula en Archivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {result.cedulas_con_error.map((errItem, idx) => (
                      <tr key={idx} className="hover:bg-red-50/50 dark:hover:bg-red-950/20">
                        <td className="py-2 px-4 font-mono font-medium text-gray-500">
                          #{errItem.fila}
                        </td>
                        <td className="py-2 px-4 font-mono font-bold text-red-600 dark:text-red-400">
                          {errItem.cedula}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </ModalImportarBase>
  );
};
