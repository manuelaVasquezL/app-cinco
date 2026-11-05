// src/modules/infraestructura/personal/components/ModalSubirComprobanteDotacion.tsx
"use client";

import React, { useState, useRef } from "react";
import { X, UploadCloud, FileText, Loader2, FileCheck } from "lucide-react";
import { toast } from "sonner";
import DatePicker from "@/components/form/date-picker";
import { EmpleadoPerfilItem, EmpleadoPerfilCompleto, EmpleadoDotacionComprobante } from "@/types/empleado";
import { personalService } from "../services/personalService";

interface Props {
  empleado: EmpleadoPerfilItem | EmpleadoPerfilCompleto;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (comprobante: EmpleadoDotacionComprobante) => void;
}

const toDateOrUndefined = (value?: string | null): Date | undefined => {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const ModalSubirComprobanteDotacion: React.FC<Props> = ({
  empleado,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fechaEntrega, setFechaEntrega] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [observaciones, setObservaciones] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
    const ext = "." + selectedFile.name.split(".").pop()?.toLowerCase();
    if (!validExtensions.includes(ext)) {
      toast.error("Formato no compatible. Solo se permiten archivos PDF o imágenes (JPG, PNG, WebP).");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("El archivo supera el tamaño máximo permitido de 10 MB.");
      return;
    }
    setFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Por favor seleccione un archivo del comprobante o acta física.");
      return;
    }
    if (!fechaEntrega) {
      toast.error("Por favor indique la fecha de entrega de dotación.");
      return;
    }

    setIsSubmitting(true);
    try {
      const comprobante = await personalService.subirComprobanteDotacion(
        empleado.id,
        file,
        fechaEntrega,
        observaciones.trim() || undefined
      );

      toast.success("Comprobante de entrega de dotación guardado correctamente.");
      if (onSuccess) {
        onSuccess(comprobante);
      }
      handleClose();
    } catch (err: any) {
      console.error("Error al subir comprobante de dotación:", err);
      const msg = err.response?.data?.error || err.response?.data?.detail || "Error al subir el comprobante de dotación.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setObservaciones("");
    setFechaEntrega(new Date().toISOString().split("T")[0]);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px] dark:bg-black/60 cursor-pointer"
        onClick={isSubmitting ? undefined : handleClose}
        aria-hidden="true"
      />

      <div className="relative my-auto w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900">
        {/* Close Button */}
        <button
          onClick={handleClose}
          disabled={isSubmitting}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <FileCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Cargar Acta / Comprobante de Dotación
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {empleado.nombre_completo} &bull; C.C. {empleado.numero_documento}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Archivo Físico Firmado (PDF o Imagen) <span className="text-red-500">*</span>
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
            />

            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-brand-500 bg-brand-50/50 dark:bg-brand-500/10"
                    : "border-gray-300 hover:border-brand-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400 mb-2">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Haga clic para seleccionar o arrastre el documento aquí
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Formatos soportados: PDF, JPG, PNG o WebP (Hasta 10 MB)
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/40 p-3.5 dark:border-brand-500/30 dark:bg-brand-500/10">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-red-500 dark:hover:bg-gray-800"
                  title="Quitar archivo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Fecha de Entrega con DatePicker */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Fecha de Entrega de Dotación <span className="text-red-500">*</span>
            </label>
            <DatePicker
              id="fecha_entrega_dotacion"
              placeholder="AAAA-MM-DD"
              defaultDate={fechaEntrega ? toDateOrUndefined(fechaEntrega) : undefined}
              onChange={(dates: Date[] | Date) => {
                const selected = Array.isArray(dates) ? dates[0] : dates;
                if (selected instanceof Date && !isNaN(selected.getTime())) {
                  const y = selected.getFullYear();
                  const m = String(selected.getMonth() + 1).padStart(2, "0");
                  const d = String(selected.getDate()).padStart(2, "0");
                  setFechaEntrega(`${y}-${m}-${d}`);
                }
              }}
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Observaciones o Detalles de la Entrega (Opcional)
            </label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: Entrega dotación 1er semestre (2 camisas, 1 pantalón y botas de seguridad)"
              className="w-full rounded-xl border border-gray-300 bg-white p-3 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !file}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Subiendo...</span>
                </>
              ) : (
                <>
                  <FileCheck className="h-4 w-4" />
                  <span>Subir Comprobante</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
