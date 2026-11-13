// src/modules/infraestructura/personal/components/ModalDotacion.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  UploadCloud,
  FileText,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import DatePicker from "@/components/form/date-picker";
import {
  EmpleadoPerfilItem,
  EmpleadoPerfilCompleto,
  DotacionActaItem,
} from "@/types/empleado";
import { personalService } from "../services/personalService";
import { usePersonalStore } from "../store/usePersonalStore";

interface Props {
  empleado: EmpleadoPerfilItem | EmpleadoPerfilCompleto;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const resolveActaUrl = (url?: string | null): string => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return `${base.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
};

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

export const ModalDotacion: React.FC<Props> = ({
  empleado,
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Estados de carga e historial
  const [actas, setActas] = useState<DotacionActaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Estados de formulario de carga
  const [showForm, setShowForm] = useState<boolean>(true);
  const [file, setFile] = useState<File | null>(null);
  const [fechaEntrega, setFechaEntrega] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [observaciones, setObservaciones] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cargarActas = useCallback(async () => {
    if (!empleado?.id) return;
    setIsLoading(true);
    try {
      const data = await personalService.getDotacionIntegral(empleado.id);
      setActas(data.actas_comprobantes || []);
    } catch (err) {
      console.error("Error al cargar historial de dotación:", err);
      toast.error("No se pudo cargar el historial de actas de dotación.");
    } finally {
      setIsLoading(false);
    }
  }, [empleado?.id]);

  useEffect(() => {
    if (isOpen && empleado?.id) {
      cargarActas();
    }
  }, [isOpen, empleado?.id, cargarActas]);

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
      toast.error(
        "Formato no compatible. Solo se permiten archivos PDF o imágenes (JPG, PNG, WebP)."
      );
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
      toast.error("Por favor seleccione un archivo del acta o comprobante.");
      return;
    }
    if (!fechaEntrega) {
      toast.error("Por favor indique la fecha de entrega de dotación.");
      return;
    }

    setIsSubmitting(true);
    try {
      await personalService.subirComprobanteDotacion(
        empleado.id,
        file,
        fechaEntrega,
        observaciones.trim() || undefined
      );

      toast.success("Acta de entrega de dotación guardada correctamente.");
      setFile(null);
      setObservaciones("");
      setFechaEntrega(new Date().toISOString().split("T")[0]);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Recargar actas del modal y refrescar la tabla de personal
      await cargarActas();
      usePersonalStore.getState().fetchEmpleados();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Error al guardar acta de dotación:", err);
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Error al guardar el comprobante de dotación.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
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
        onClick={isSubmitting ? undefined : onClose}
        aria-hidden="true"
      />

      <div className="relative my-auto w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900 max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Gestión de Dotación
              </h3>
              <span className="inline-flex items-center justify-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                {actas.length} acta(s)
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {empleado.nombre_completo} &bull; {empleado.tipo_documento || "CC"}{" "}
              {empleado.numero_documento}
            </p>
          </div>
        </div>

        {/* Modal Content Scrollable */}
        <div className="overflow-y-auto pr-1 py-4 space-y-5 flex-1">
          {/* Formulario de Carga Directa */}
          <div className="rounded-xl border border-gray-200/80 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setShowForm(!showForm)}
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Registrar Nueva Entrega de Dotación
                </h4>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showForm ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Fecha de Entrega <span className="text-red-500">*</span>
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

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Observaciones
                    </label>
                    <input
                      type="text"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Ej: Camisa, Pantalón, Botas"
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Dropzone */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Acta Firmada (PDF o Imagen) <span className="text-red-500">*</span>
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
                      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
                        isDragging
                          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/10"
                          : "border-gray-300 hover:border-blue-400 hover:bg-white dark:border-gray-700 dark:hover:bg-gray-800"
                      }`}
                    >
                      <UploadCloud className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-1" />
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                        Clic para seleccionar o arrastra el archivo aquí
                      </p>
                      <p className="text-[11px] text-gray-400">
                        PDF, JPG, PNG o WebP (Hasta 10 MB)
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800/40 dark:bg-blue-900/20">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="rounded-lg p-1 text-gray-400 hover:bg-white hover:text-red-600 dark:hover:bg-gray-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting || !file}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Guardar Entrega</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Listado Histórico de Actas de Dotación */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Histórico de Actas Registradas
            </h4>

            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-xs">Cargando actas de dotación...</span>
              </div>
            ) : actas.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 p-6 text-center dark:border-gray-800">
                <FileText className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  No hay actas de dotación registradas
                </p>
                <p className="text-[11px] text-gray-400 max-w-sm mt-0.5">
                  Utilice el formulario superior para registrar la primera entrega firmada de prendas o dotación del colaborador.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {actas.map((acta) => {
                  const isPdf = acta.archivo_url?.toLowerCase().endsWith(".pdf");
                  return (
                    <div
                      key={acta.id}
                      className="flex flex-col justify-between rounded-xl border border-gray-200/80 bg-white p-3.5 hover:border-blue-200 transition-all dark:border-gray-800 dark:bg-gray-800/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              isPdf
                                ? "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                                : "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                            }`}
                          >
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                              Entrega: {acta.fecha_entrega || "Sin fecha"}
                            </span>
                            {acta.subido_por && (
                              <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                Diligencia: {acta.subido_por}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {acta.observaciones && (
                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300 italic line-clamp-2 bg-gray-50 dark:bg-gray-800 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                          &ldquo;{acta.observaciones}&rdquo;
                        </p>
                      )}

                      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[10px] text-gray-400">
                        <span>F. Edición: {acta.created_at || "-"}</span>
                        {acta.archivo_url ? (
                          <a
                            href={resolveActaUrl(acta.archivo_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                          >
                            <span>Ver Acta</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span>Sin archivo</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
