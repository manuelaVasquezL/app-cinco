// src/modules/infraestructura/personal/components/ModalCrearEmpleado.tsx
"use client";

import React, { useState } from "react";
import { X, UserPlus, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { personalService } from "../services/personalService";
import { usePersonalStore } from "../store/usePersonalStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ModalCrearEmpleado: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { fetchEmpleados } = usePersonalStore();
  const [tipoDoc, setTipoDoc] = useState("CC");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [primerNombre, setPrimerNombre] = useState("");
  const [segundoNombre, setSegundoNombre] = useState("");
  const [primerApellido, setPrimerApellido] = useState("");
  const [segundoApellido, setSegundoApellido] = useState("");
  const [cargo, setCargo] = useState("");
  const [ciudadOperacion, setCiudadOperacion] = useState("CALI");
  const [tipoContrato, setTipoContrato] = useState("OBRA_LABOR");
  const [fechaIngreso, setFechaIngreso] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numeroDoc.trim() || !primerNombre.trim() || !primerApellido.trim() || !cargo.trim()) {
      toast.error("Complete los campos obligatorios (*)");
      return;
    }

    setIsSubmitting(true);
    try {
      const fullNombres = [primerNombre.trim(), segundoNombre.trim()].filter(Boolean).join(" ").toUpperCase();
      const fullApellidos = [primerApellido.trim(), segundoApellido.trim()].filter(Boolean).join(" ").toUpperCase();

      await personalService.createEmpleado({
        tipo_documento: tipoDoc,
        numero_documento: numeroDoc.trim(),
        nombres: fullNombres,
        apellidos: fullApellidos,
        primer_nombre: primerNombre.trim().toUpperCase(),
        segundo_nombre: segundoNombre.trim().toUpperCase() || undefined,
        primer_apellido: primerApellido.trim().toUpperCase(),
        segundo_apellido: segundoApellido.trim().toUpperCase() || undefined,
        laboral: {
          cargo: cargo.trim().toUpperCase(),
          area: "OPERACIONES",
          carpeta: "OPERACIONES",
          sede: ciudadOperacion,
          ciudad_operacion: ciudadOperacion,
          tipo_contrato: tipoContrato,
          fecha_ingreso: fechaIngreso,
          etapa_induccion: "EN_FORMACION",
        },
      });

      toast.success("Colaborador registrado exitosamente en etapa EN_FORMACION.");
      await fetchEmpleados();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg =
        err?.detail ||
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        (typeof err?.response?.data === "string" ? err.response.data : null) ||
        err?.message ||
        "Error al registrar el colaborador";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:items-center sm:p-4 overflow-y-auto animate-fade-in">
      {/* Overlay con fondo claro difuminado idéntico a Operaciones (Actividades / Agenda) */}
      <div
        className="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px] dark:bg-black/60 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative my-auto w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Nuevo Colaborador (Alta en Base de Personal)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Inicia automáticamente en etapa EN_FORMACION (Gestión Humana)
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Tipo Doc. <span className="text-red-500">*</span>
              </label>
              <select
                value={tipoDoc}
                onChange={(e) => setTipoDoc(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="CC">Cédula de Ciudadanía (CC)</option>
                <option value="CE">Cédula de Extranjería (CE)</option>
                <option value="PT">Permiso por Protección Temporal (PPT)</option>
                <option value="TI">Tarjeta de Identidad (TI)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Número de Documento <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={numeroDoc}
                onChange={(e) => setNumeroDoc(e.target.value.replace(/\D/g, ""))}
                placeholder="Ej: 1144123456"
                required
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 font-mono text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Primer Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={primerNombre}
                onChange={(e) => setPrimerNombre(e.target.value)}
                placeholder="Ej: JUAN"
                required
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm uppercase text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Segundo Nombre
              </label>
              <input
                type="text"
                value={segundoNombre}
                onChange={(e) => setSegundoNombre(e.target.value)}
                placeholder="Ej: CARLOS"
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm uppercase text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Primer Apellido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={primerApellido}
                onChange={(e) => setPrimerApellido(e.target.value)}
                placeholder="Ej: PEREZ"
                required
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm uppercase text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Segundo Apellido
              </label>
              <input
                type="text"
                value={segundoApellido}
                onChange={(e) => setSegundoApellido(e.target.value)}
                placeholder="Ej: GOMEZ"
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm uppercase text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Cargo Operativo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Ej: TECNICO DE REDES"
                required
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm uppercase text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Ciudad de Operación
              </label>
              <select
                value={ciudadOperacion}
                onChange={(e) => setCiudadOperacion(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="CALI">CALI</option>
                <option value="PALMIRA">PALMIRA</option>
                <option value="YUMBO">YUMBO</option>
                <option value="JAMUNDI">JAMUNDI</option>
                <option value="BUENAVENTURA">BUENAVENTURA</option>
                <option value="POPAYAN">POPAYAN</option>
                <option value="BOGOTA">BOGOTA</option>
                <option value="MEDELLIN">MEDELLIN</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Tipo Contrato
              </label>
              <select
                value={tipoContrato}
                onChange={(e) => setTipoContrato(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="OBRA_LABOR">Obra o Labor</option>
                <option value="FIJO">Término Fijo</option>
                <option value="INDEFINIDO">Término Indefinido</option>
                <option value="APRENDIZAJE">Aprendizaje SENA</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Fecha de Ingreso <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 focus:outline-hidden disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Crear Colaborador</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
