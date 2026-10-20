// src/modules/infraestructura/personal/components/ModalContactoEmergencia.tsx
"use client";

import React, { useState, useEffect } from "react";
import { X, PhoneCall, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EmpleadoPerfilCompleto, EmpleadoContactoEmergencia } from "@/types/empleado";
import { personalService } from "../services/personalService";
import { usePersonalStore } from "../store/usePersonalStore";

interface Props {
  empleado: EmpleadoPerfilCompleto;
  isOpen: boolean;
  contactoToEdit?: EmpleadoContactoEmergencia | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const PARENTESCOS = [
  { value: "PADRE", label: "Padre" },
  { value: "MADRE", label: "Madre" },
  { value: "CONYUGE", label: "Cónyuge / Pareja" },
  { value: "HIJO", label: "Hijo / Hija" },
  { value: "HERMANO", label: "Hermano / Hermana" },
  { value: "OTRO", label: "Otro / Familiar" },
];

export const ModalContactoEmergencia: React.FC<Props> = ({
  empleado,
  isOpen,
  contactoToEdit,
  onClose,
  onSuccess,
}) => {
  const { fetchEmpleadoDetail } = usePersonalStore();
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [parentesco, setParentesco] = useState("MADRE");
  const [telefono, setTelefono] = useState("");
  const [esPrincipal, setEsPrincipal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (contactoToEdit) {
      setNombreCompleto(contactoToEdit.nombre_completo || contactoToEdit.nombre_contacto || "");
      setParentesco(contactoToEdit.parentesco || "MADRE");
      setTelefono(contactoToEdit.telefono || contactoToEdit.telefono_principal || "");
      setEsPrincipal(contactoToEdit.es_principal ?? false);
    } else {
      setNombreCompleto("");
      setParentesco("MADRE");
      setTelefono("");
      setEsPrincipal(
        !empleado.contactos_emergencia || empleado.contactos_emergencia.length === 0
      );
    }
  }, [contactoToEdit, empleado]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNombre = nombreCompleto.trim().toUpperCase();
    const cleanTel = telefono.trim().replace(/[^\d+ -]/g, "");

    if (!cleanNombre || cleanNombre.length < 3) {
      toast.error("Ingrese el nombre completo del contacto de emergencia.");
      return;
    }

    if (!cleanTel || cleanTel.length < 7) {
      toast.error("Ingrese un número telefónico de contacto válido.");
      return;
    }

    setIsSubmitting(true);
    try {
      await personalService.gestionarContactoEmergencia(empleado.id, {
        contacto_id: contactoToEdit?.id,
        nombre_completo: cleanNombre,
        parentesco,
        telefono: cleanTel,
        es_principal: esPrincipal,
      });

      toast.success(
        contactoToEdit
          ? `Contacto ${cleanNombre} actualizado correctamente.`
          : `Contacto ${cleanNombre} registrado en la red de apoyo.`
      );

      await fetchEmpleadoDetail(empleado.id);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar contacto de emergencia";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:items-center sm:p-4 overflow-y-auto animate-fade-in">
      {/* Overlay con fondo claro difuminado idéntico a Operaciones (Actividades / Agenda) */}
      <div
        className="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px] dark:bg-black/60 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative my-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {contactoToEdit ? "Editar Contacto de Emergencia" : "Registrar Contacto de Emergencia"}
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

        {/* Notice */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <span>
            <strong>Red de Apoyo:</strong> Esta persona será contactada en primera instancia ante cualquier situación de urgencia o eventualidad médica laboral.
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Nombre Completo del Contacto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value.toUpperCase())}
              placeholder="Ej: MARÍA ELENA GÓMEZ"
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Teléfono de Contacto <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 3001234567"
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-mono text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-800/40">
            <input
              type="checkbox"
              id="es_principal_chk"
              checked={esPrincipal}
              onChange={(e) => setEsPrincipal(e.target.checked)}
              className="h-4 w-4 rounded-sm border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800"
            />
            <label htmlFor="es_principal_chk" className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
              Contacto Principal Prioritario (Llamar primero ante emergencias)
            </label>
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 focus:outline-hidden disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <PhoneCall className="h-4 w-4" />
                  <span>{contactoToEdit ? "Actualizar Contacto" : "Guardar Contacto"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
