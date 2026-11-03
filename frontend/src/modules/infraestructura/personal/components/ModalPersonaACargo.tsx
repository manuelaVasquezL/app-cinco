// src/modules/infraestructura/personal/components/ModalPersonaACargo.tsx
"use client";

import React, { useState } from "react";
import { X, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EmpleadoPerfilCompleto, EmpleadoPersonaACargo } from "@/types/empleado";
import { personalService } from "../services/personalService";
import { usePersonalStore } from "../store/usePersonalStore";
import DatePicker from "@/components/form/date-picker";

interface Props {
  empleado: EmpleadoPerfilCompleto;
  isOpen: boolean;
  personaToEdit?: EmpleadoPersonaACargo | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const PARENTESCOS = [
  { value: "HIJO", label: "Hijo / Hija" },
  { value: "CONYUGE", label: "Cónyuge / Pareja" },
  { value: "PADRE", label: "Padre" },
  { value: "MADRE", label: "Madre" },
  { value: "HERMANO", label: "Hermano / Hermana" },
  { value: "ABUELO", label: "Abuelo / Abuela" },
  { value: "NIETO", label: "Nieto / Nieta" },
  { value: "SOBRINO", label: "Sobrino / Sobrina" },
  { value: "TIO", label: "Tío / Tía" },
  { value: "CUÑADO", label: "Cuñado / Cuñada" },
  { value: "SUEGRO", label: "Suegro / Suegra" },
  { value: "PRIMO", label: "Primo / Prima" },
  { value: "OTRO", label: "Otro Familiar / Dependiente" },
];

const TIPOS_DOCUMENTO = [
  { value: "RC", label: "RC - Registro Civil" },
  { value: "TI", label: "TI - Tarjeta de Identidad" },
  { value: "CC", label: "CC - Cédula de Ciudadanía" },
  { value: "CE", label: "CE - Cédula de Extranjería" },
  { value: "PPT", label: "PPT - Permiso Protección Temporal" },
  { value: "PEP", label: "PEP - Permiso Especial Permanencia" },
  { value: "PASAPORTE", label: "Pasaporte" },
];

const toDateOrUndefined = (value?: string | null): Date | undefined => {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12);
};

interface FormProps {
  empleado: EmpleadoPerfilCompleto;
  personaToEdit?: EmpleadoPersonaACargo | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const ModalPersonaACargoForm: React.FC<FormProps> = ({
  empleado,
  personaToEdit,
  onClose,
  onSuccess,
}) => {
  const { fetchEmpleadoDetail } = usePersonalStore();
  const [nombreCompleto, setNombreCompleto] = useState(personaToEdit?.nombre_completo || "");
  const [parentesco, setParentesco] = useState(personaToEdit?.parentesco || "HIJO");
  const [tipoDocumento, setTipoDocumento] = useState(personaToEdit?.tipo_documento || "RC");
  const [numeroDocumento, setNumeroDocumento] = useState(personaToEdit?.numero_documento || "");
  const [fechaNacimiento, setFechaNacimiento] = useState(personaToEdit?.fecha_nacimiento || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cálculo de edad referencial si ingresó fecha de nacimiento
  const calcularEdad = (fechaStr: string) => {
    if (!fechaStr) return null;
    const nacimiento = new Date(fechaStr);
    if (isNaN(nacimiento.getTime())) return null;
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad >= 0 ? edad : null;
  };

  const edadReferencial = calcularEdad(fechaNacimiento);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNombre = nombreCompleto.trim().toUpperCase();

    if (!cleanNombre || cleanNombre.length < 3) {
      toast.error("Ingrese el nombre completo de la persona a cargo.");
      return;
    }

    if (!parentesco) {
      toast.error("Seleccione el parentesco.");
      return;
    }

    setIsSubmitting(true);
    try {
      await personalService.gestionarPersonaACargo(empleado.id, {
        persona_id: personaToEdit?.id,
        nombre_completo: cleanNombre,
        parentesco,
        tipo_documento: tipoDocumento || null,
        numero_documento: numeroDocumento.trim() || null,
        fecha_nacimiento: fechaNacimiento || null,
      });

      toast.success(
        personaToEdit
          ? `Beneficiario(a) ${cleanNombre} actualizado correctamente.`
          : `Beneficiario(a) ${cleanNombre} registrado exitosamente.`
      );

      await fetchEmpleadoDetail(empleado.id);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar persona a cargo";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:items-center sm:p-4 overflow-y-auto animate-fade-in">
      <div
        className="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px] dark:bg-black/60 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative my-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {personaToEdit ? "Editar Persona a Cargo" : "Registrar Persona a Cargo"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {empleado.nombre_completo} • CC {empleado.numero_documento}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Nombre Completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value.toUpperCase())}
              placeholder="Ej: JUAN PÉREZ GÓMEZ"
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Parentesco <span className="text-red-500">*</span>
            </label>
            <select
              value={parentesco}
              onChange={(e) => setParentesco(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              {PARENTESCOS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Tipo de Documento
              </label>
              <select
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {TIPOS_DOCUMENTO.map((td) => (
                  <option key={td.value} value={td.value}>
                    {td.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Número de Documento
              </label>
              <input
                type="text"
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value.trim())}
                placeholder="Ej: 1023456789"
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-mono text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Fecha de Nacimiento
              </label>
              {edadReferencial !== null && (
                <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400">
                  {edadReferencial} {edadReferencial === 1 ? "año" : "años"}
                </span>
              )}
            </div>
            <DatePicker
              id="fecha_nacimiento_persona_a_cargo"
              placeholder="AAAA-MM-DD"
              defaultDate={fechaNacimiento ? toDateOrUndefined(fechaNacimiento) : undefined}
              yearRange={{
                from: 1940,
                to: new Date().getFullYear(),
              }}
              options={{
                maxDate: "today",
              }}
              onChange={(dates: Date[] | Date) => {
                const selected = Array.isArray(dates) ? dates[0] : dates;
                if (selected instanceof Date && !isNaN(selected.getTime())) {
                  const y = selected.getFullYear();
                  const m = String(selected.getMonth() + 1).padStart(2, "0");
                  const d = String(selected.getDate()).padStart(2, "0");
                  setFechaNacimiento(`${y}-${m}-${d}`);
                } else if (!selected) {
                  setFechaNacimiento("");
                }
              }}
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Permite validar la edad para afiliaciones a caja de compensación y beneficios de bienestar.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 rounded-lg px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-violet-500 focus:outline-hidden disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  <span>{personaToEdit ? "Actualizar Beneficiario" : "Guardar Beneficiario"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ModalPersonaACargo: React.FC<Props> = ({
  empleado,
  isOpen,
  personaToEdit,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  return (
    <ModalPersonaACargoForm
      key={personaToEdit?.id ?? "new"}
      empleado={empleado}
      personaToEdit={personaToEdit}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
};
