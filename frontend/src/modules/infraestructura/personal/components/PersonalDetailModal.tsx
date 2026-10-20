// src/modules/infraestructura/personal/components/PersonalDetailModal.tsx
"use client";

import React, { useState } from "react";
import {
  X,
  Briefcase,
  User,
  Shield,
  Car,
  CreditCard,
  History,
  Building2,
  Calendar,
  Phone,
  PhoneCall,
  Star,
  Trash2,
  Mail,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  SendHorizontal,
  Plus,
  Loader2,
  Pencil,
  Shirt,
  FileText,
  ExternalLink,
  Edit3,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { EmpleadoPerfilCompleto, EmpleadoAuditoriaLog } from "@/types/empleado";
import { personalService } from "../services/personalService";
import { ModalCuentaBancaria } from "./ModalCuentaBancaria";
import { ModalContactoEmergencia } from "./ModalContactoEmergencia";
import { ModalEntregaGH } from "./ModalEntregaGH";
import { ModalAsignarPlaca } from "./ModalAsignarPlaca";
import { ModalEditarPerfil } from "./ModalEditarPerfil";

interface Props {
  empleado: EmpleadoPerfilCompleto | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

type TabKey = "laboral" | "datos" | "sst" | "movilidad" | "cuentas" | "auditoria";

export const PersonalDetailModal: React.FC<Props> = ({
  empleado,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>("laboral");
  const [showModalCuenta, setShowModalCuenta] = useState(false);
  const [showModalEntrega, setShowModalEntrega] = useState(false);
  const [showModalPlaca, setShowModalPlaca] = useState(false);
  const [showModalContactoEmergencia, setShowModalContactoEmergencia] = useState(false);
  const [contactoEmergenciaToEdit, setContactoEmergenciaToEdit] = useState<any>(null);
  const [isDeletingContacto, setIsDeletingContacto] = useState<number | null>(null);

  const handleEliminarContactoEmergencia = async (contactoId?: number) => {
    if (!contactoId || !empleado?.id) return;
    if (!confirm("¿Está seguro de eliminar este contacto de emergencia?")) return;
    setIsDeletingContacto(contactoId);
    try {
      await personalService.eliminarContactoEmergencia(empleado.id, contactoId);
      toast.success("Contacto de emergencia eliminado.");
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al eliminar contacto";
      toast.error(msg);
    } finally {
      setIsDeletingContacto(null);
    }
  };
  const [showModalEditar, setShowModalEditar] = useState(false);
  const [seccionEditar, setSeccionEditar] = useState<"laboral" | "contacto" | "sst" | "dotacion" | "movilidad">("laboral");
  const [auditLogs, setAuditLogs] = useState<EmpleadoAuditoriaLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  React.useEffect(() => {
    if (isOpen && empleado?.id && activeTab === "auditoria") {
      setIsLoadingAudit(true);
      personalService.getAuditoriaLog(empleado.id)
        .then((data) => setAuditLogs(Array.isArray(data) ? data : []))
        .catch(() => setAuditLogs([]))
        .finally(() => setIsLoadingAudit(false));
    }
  }, [isOpen, empleado?.id, activeTab]);

  const getDiasEnEmpresa = () => {
    if (!empleado) return 0;
    if (empleado.dias_en_empresa !== undefined && empleado.dias_en_empresa !== null) {
      return empleado.dias_en_empresa;
    }
    const fi = empleado.laboral?.fecha_ingreso || (empleado as any).fecha_ingreso;
    if (!fi) return 0;
    try {
      const inicio = new Date(fi);
      const fin = (empleado.laboral?.fecha_egreso || (empleado.laboral as any)?.fecha_retiro)
        ? new Date(empleado.laboral?.fecha_egreso || (empleado.laboral as any)?.fecha_retiro)
        : new Date();
      const diffTime = fin.getTime() - inicio.getTime();
      return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    } catch {
      return 0;
    }
  };

  const getMediaUrl = (path?: string | null) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return `${base.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const formatFechaHora = (fechaStr?: string | null) => {
    if (!fechaStr) return "N/A";
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return fechaStr;
      return d.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return fechaStr;
    }
  };

  if (!isOpen || !empleado) return null;

  const handleOpenEditar = (seccion: "laboral" | "contacto" | "sst" | "dotacion") => {
    setSeccionEditar(seccion);
    setShowModalEditar(true);
  };

  const getInitials = () => {
    const p1 = empleado.primer_nombre?.[0] || empleado.nombres?.[0] || "";
    const p2 = empleado.primer_apellido?.[0] || empleado.apellidos?.[0] || "";
    return `${p1}${p2}`.toUpperCase() || "EP";
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "laboral", label: "Laboral & Inducción", icon: <Briefcase className="h-4 w-4" /> },
    { key: "datos", label: "Datos Básicos", icon: <User className="h-4 w-4" /> },
    { key: "sst", label: "Seguridad Social, SST & Dotación", icon: <Shield className="h-4 w-4" /> },
    { key: "movilidad", label: "Movilidad & Flota", icon: <Car className="h-4 w-4" /> },
    { key: "cuentas", label: "Cuentas & Familia", icon: <CreditCard className="h-4 w-4" /> },
    { key: "auditoria", label: "Auditoría", icon: <History className="h-4 w-4" /> },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:items-center sm:p-4 overflow-y-auto animate-fade-in">
        {/* Overlay con fondo claro difuminado idéntico a Operaciones (Actividades / Agenda) */}
        <div
          className="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px] dark:bg-black/60 cursor-pointer"
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="relative my-auto flex flex-col w-full max-w-4xl max-h-[88vh] rounded-3xl border border-gray-200 bg-white shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-lg font-bold text-white shadow-md">
                {(empleado.foto_url || empleado.foto_perfil_url) ? (
                  <img
                    src={(empleado.foto_url || empleado.foto_perfil_url) || undefined}
                    alt={empleado.nombre_completo}
                    className="h-full w-full rounded-2xl object-cover"
                  />
                ) : (
                  getInitials()
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {empleado.nombre_completo}
                  </h2>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      empleado.estado === "ACTIVO"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                        : empleado.estado === "EN_FORMACION"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {empleado.estado}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {empleado.tipo_documento} {empleado.numero_documento} • {empleado.laboral?.cargo || "Sin cargo asignado"} • {empleado.laboral?.ciudad_operacion || "Sin ciudad"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (activeTab === "laboral") handleOpenEditar("laboral");
                  else if (activeTab === "sst") handleOpenEditar("sst");
                  else handleOpenEditar("contacto");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <Pencil className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                <span>Editar Ficha</span>
              </button>

              {empleado.laboral?.etapa_induccion !== "ENTREGADO" && (
                <button
                  onClick={() => setShowModalEntrega(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400 dark:hover:bg-brand-500/25"
                >
                  <SendHorizontal className="h-3.5 w-3.5" />
                  <span>Entrega GH</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-100 px-6 overflow-x-auto dark:border-gray-800 scrollbar-none">
            <div className="flex items-center justify-between min-w-[760px] pb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex shrink-0 items-center gap-1.5 py-3 px-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === tab.key
                      ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                      : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {/* TAB 1: LABORAL */}
            {activeTab === "laboral" && (
              <div className="space-y-6">
                {/* Stepper Etapa Inducción */}
                <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Ciclo de Vida / Etapa de Inducción
                    </h4>
                    <button
                      onClick={() => handleOpenEditar("laboral")}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400 transition-colors"
                      title="Editar Información Laboral"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Editar Datos Laborales</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {[
                      { step: "EN_FORMACION", label: "1. En Formación" },
                      { step: "APROBADO_GH", label: "2. Aprobado GH" },
                      { step: "ENTREGADO", label: "3. Entregado a Operaciones" },
                    ].map((st, i) => {
                      const isCurrent = empleado.laboral?.etapa_induccion === st.step;
                      const isPast =
                        st.step === "EN_FORMACION" ||
                        (st.step === "APROBADO_GH" &&
                          empleado.laboral?.etapa_induccion === "ENTREGADO");
                      return (
                        <div key={st.step} className="flex-1 flex flex-col items-center text-center">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                              isCurrent
                                ? "bg-brand-500 text-white ring-4 ring-brand-100 dark:ring-brand-900/40"
                                : isPast
                                ? "bg-emerald-500 text-white"
                                : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                            }`}
                          >
                            {isPast && !isCurrent ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                          </div>
                          <span className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                            {st.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Grid Laboral Completo */}
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Cargo</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.cargo || "No asignado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tipo de Labor</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        empleado.laboral?.tipo_labor === 'SUPERVISOR'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                          : empleado.laboral?.tipo_labor === 'ADMINISTRATIVO'
                          ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
                          : empleado.laboral?.tipo_labor === 'TRANSVERSAL'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      }`}>
                        {empleado.laboral?.tipo_labor || "OPERATIVO"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Sede Operativa</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.sede || "MEDELLIN"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Área / Carpeta</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.area || "N/A"} / {empleado.laboral?.carpeta || "N/A"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Código SAP</p>
                    <p className="text-sm font-semibold font-mono text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.codigo_sap || "No asignado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Móvil / Cuadrilla</p>
                    <p className="text-sm font-semibold font-mono text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.movil || "Sin móvil asignado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Zona o Nodo</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.zona_nodo || "No asignada"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Puesto de Trabajo</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.puesto || "No registrado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Supervisor Directo</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.supervisor_nombre || (empleado.laboral as any)?.supervisor_directo_nombre || "No asignado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Padrino / Mentor</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.padrino_nombre || "No asignado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Formador GH</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.formador || "No asignado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Grupo de Comisiones</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.grupo_comisiones || "No asignado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Nivel de Estudio</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.nivel_estudio || "No registrado"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Fecha de Ingreso</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.fecha_ingreso || "N/A"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Periodo de Prueba</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {empleado.laboral?.dias_para_periodo_prueba !== undefined && empleado.laboral?.dias_para_periodo_prueba !== null
                        ? empleado.laboral.dias_para_periodo_prueba >= 0
                          ? `${empleado.laboral.dias_para_periodo_prueba} días restantes`
                          : "Superado"
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {empleado.laboral?.funcion_cargo && (
                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Funciones del Cargo</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                      {empleado.laboral.funcion_cargo}
                    </p>
                  </div>
                )}

                {(empleado.laboral?.practica_lectiva_inicio || empleado.laboral?.practica_productiva_inicio) && (
                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      Etapas de Aprendizaje SENA / Formación Dual
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-2xs text-gray-400">Etapa Lectiva</p>
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                          {empleado.laboral.practica_lectiva_inicio || "N/A"} hasta {empleado.laboral.practica_lectiva_fin || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-2xs text-gray-400">Etapa Productiva</p>
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                          {empleado.laboral.practica_productiva_inicio || "N/A"} hasta {empleado.laboral.practica_productiva_fin || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {empleado.laboral?.motivo_retiro_gh && (
                  <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/30 dark:bg-red-950/20">
                    <h5 className="text-xs font-bold text-red-800 dark:text-red-400 uppercase">
                      Información de Retiro / Egreso
                    </h5>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      <strong>Motivo GH:</strong> {empleado.laboral.motivo_retiro_gh}
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                      <strong>Motivo Operaciones:</strong> {empleado.laboral.motivo_retiro_operaciones || "N/A"}
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                      <strong>Fecha de Retiro:</strong> {empleado.laboral.fecha_retiro || "N/A"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: DATOS PERSONALES */}
            {activeTab === "datos" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900 flex flex-col justify-between gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Identificación Oficial</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                          {empleado.tipo_documento} {empleado.numero_documento}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Expedida: {empleado.fecha_expedicion_documento || empleado.fecha_expedicion_doc || empleado.lugar_expedicion_doc || "No registrada"}
                          {empleado.pasaporte ? ` • Cédula Siigo: ${empleado.pasaporte}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => handleOpenEditar("contacto")}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400"
                        title="Editar Identidad y Documentos"
                      >
                        <Pencil className="h-3 w-3" />
                        <span>Editar</span>
                      </button>
                    </div>

                    {/* Soportes de Cédula (Lado y Lado) */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(() => {
                        const frontal = empleado.documentos_adjuntos?.find((d) => d.tipo_documento === "CEDULA_FRONTAL");
                        const posterior = empleado.documentos_adjuntos?.find((d) => d.tipo_documento === "CEDULA_POSTERIOR");
                        return (
                          <>
                            <div className="flex items-center justify-between rounded-lg border border-gray-200/60 bg-gray-50/50 p-2 dark:border-gray-800 dark:bg-gray-800/40">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5 text-brand-500" />
                                Cédula Frontal
                              </span>
                              {frontal ? (
                                <a
                                  href={getMediaUrl(frontal.archivo_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span>Ver</span>
                                </a>
                              ) : (
                                <span className="text-2xs text-gray-400 italic">Sin cargar</span>
                              )}
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-gray-200/60 bg-gray-50/50 p-2 dark:border-gray-800 dark:bg-gray-800/40">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5 text-brand-500" />
                                Cédula Reverso
                              </span>
                              {posterior ? (
                                <a
                                  href={getMediaUrl(posterior.archivo_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span>Ver</span>
                                </a>
                              ) : (
                                <span className="text-2xs text-gray-400 italic">Sin cargar</span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900 flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Fecha de Nacimiento & Género</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                        {empleado.fecha_nacimiento || "N/A"} • {empleado.genero || "N/A"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenEditar("contacto")}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400"
                      title="Editar Fecha de Nacimiento y Género"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Editar</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Contacto y Residencia
                    </h4>
                    <button
                      onClick={() => handleOpenEditar("contacto")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Editar Contacto</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Celulares Principal y Corporativo</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                        {empleado.contacto?.celular_personal || empleado.contacto?.telefono_personal || "Sin celular registrado"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Corporativo: {empleado.contacto?.celular_corporativo || empleado.contacto?.telefono_corporativo || "No asignado"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Correos Electrónicos</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                        {empleado.contacto?.correo_personal || empleado.contacto?.email_personal || "Sin correo registrado"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Corporativo: {empleado.contacto?.correo_corporativo || empleado.contacto?.email_corporativo || "No asignado"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Líneas Adicionales</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                        {empleado.contacto?.celular_alterno ? `Alterno: ${empleado.contacto.celular_alterno}` : "Sin celular alterno"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Fijo: {empleado.contacto?.telefono_fijo || "Sin teléfono fijo"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Billetera Claro Pay</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                        {empleado.contacto?.claro_pay ? (
                          <span className="inline-flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400">
                            {empleado.contacto.claro_pay}
                          </span>
                        ) : (
                          "No registrada"
                        )}
                      </p>
                    </div>

                    <div className="sm:col-span-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Dirección de Residencia</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                        {empleado.contacto?.direccion_residencia || "No registrada"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SEGURIDAD SOCIAL, SST & DOTACION */}
            {activeTab === "sst" && (
              <div className="space-y-6">
                {/* 1. Seguridad Social & Certificaciones SST */}
                <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Seguridad Social & Certificaciones SST
                    </h4>
                    <button
                      onClick={() => handleOpenEditar("sst")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Editar Seguridad Social & SST</span>
                    </button>
                  </div>

                  {/* Afiliaciones */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Afiliaciones Integrales</p>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Entidad EPS</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                          {empleado.seguridad_social?.eps || "Sin asignar"}
                        </p>
                      </div>

                      <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Fondo Pensiones (AFP)</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                          {empleado.seguridad_social?.afp || empleado.seguridad_social?.afp_pensiones || "Sin asignar"}
                        </p>
                      </div>

                      <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Riesgos Laborales (ARL)</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                          {empleado.seguridad_social?.arl || "COLMENA"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Certificaciones y Vencimientos */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Aptitud y Certificaciones Operativas</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {/* Curso Alturas */}
                      <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-800 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Curso Alturas</p>
                            {((empleado.certificaciones_sst || empleado.sst)?.certificado_alturas_url ||
                              empleado.documentos_adjuntos?.find((d) => d.tipo_documento === "CERTIFICADO_ALTURAS")?.archivo_url) && (
                              <a
                                href={getMediaUrl(
                                  (empleado.certificaciones_sst || empleado.sst)?.certificado_alturas_url ||
                                  empleado.documentos_adjuntos?.find((d) => d.tipo_documento === "CERTIFICADO_ALTURAS")?.archivo_url
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-2xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>Ver PDF</span>
                              </a>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                            {(empleado.certificaciones_sst || empleado.sst)?.estado_alturas || (empleado.certificaciones_sst || empleado.sst)?.curso_alturas_nivel || "No certificado"}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Vence: {(empleado.certificaciones_sst || empleado.sst)?.vencimiento_alturas || (empleado.certificaciones_sst || empleado.sst)?.curso_alturas_fecha_vence || "N/A"}
                        </p>
                      </div>

                      {/* Permiso de Trabajo */}
                      <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-800 flex flex-col justify-between">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Permiso de Trabajo</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                            {(empleado.certificaciones_sst || empleado.sst)?.permiso_trabajo || "Sin permiso"}
                          </p>
                        </div>
                      </div>

                      {/* Examen Médico Ocupacional */}
                      <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-800 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Examen Médico Ocupacional</p>
                            {((empleado.certificaciones_sst || empleado.sst)?.certificado_tecnico_url ||
                              empleado.documentos_adjuntos?.find((d) => d.tipo_documento === "CERTIFICADO_TECNICO" || d.tipo_documento === "CERTIFICADO_MEDICO")?.archivo_url) && (
                              <a
                                href={getMediaUrl(
                                  (empleado.certificaciones_sst || empleado.sst)?.certificado_tecnico_url ||
                                  empleado.documentos_adjuntos?.find((d) => d.tipo_documento === "CERTIFICADO_TECNICO" || d.tipo_documento === "CERTIFICADO_MEDICO")?.archivo_url
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-2xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>Ver Soporte</span>
                              </a>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                            {(empleado.certificaciones_sst || empleado.sst)?.estado_tecnico || "Periódico"}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Vence: {(empleado.certificaciones_sst || empleado.sst)?.vencimiento_tecnico || (empleado.certificaciones_sst || empleado.sst)?.examen_medico_fecha_vence || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Dotación & Activos */}
                <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <Shirt className="h-4 w-4 text-brand-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Dotación de Operaciones & Tallas
                      </h4>
                    </div>
                    <button
                      onClick={() => handleOpenEditar("dotacion")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Editar Dotación</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                    <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-800">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Talla Camisa</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                        {(empleado.dotacion_activos || empleado.dotacion)?.talla_camisa || "Sin registrar"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-800">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Talla Pantalón</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                        {(empleado.dotacion_activos || empleado.dotacion)?.talla_pantalon || "Sin registrar"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-800">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Botas</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                        {(empleado.dotacion_activos || empleado.dotacion)?.talla_calzado || "Sin registrar"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-800">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Chaqueta</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                        {(empleado.dotacion_activos || empleado.dotacion)?.talla_chaqueta || "Sin registrar"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-800">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Guerrera</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                        {(empleado.dotacion_activos || empleado.dotacion)?.talla_guerrera || "Sin registrar"}
                      </p>
                    </div>
                  </div>



                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Carnet Corporativo:</span>
                      {(empleado.dotacion_activos || empleado.dotacion)?.tiene_carnet ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Entregado al colaborador
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                          Pendiente de Entrega
                        </span>
                      )}
                    </div>
                    {(empleado.dotacion_activos || empleado.dotacion)?.fecha_entrega_carnet && (
                      <span className="text-xs text-gray-400">
                        Fecha entrega: {(empleado.dotacion_activos || empleado.dotacion)?.fecha_entrega_carnet}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: MOVILIDAD & FLOTA */}
            {activeTab === "movilidad" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Vehículo Asignado y Movilidad (Tabla 7: empleados_movilidad)
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSeccionEditar("movilidad");
                        setShowModalEditar(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Editar Movilidad</span>
                    </button>
                    <button
                      onClick={() => setShowModalPlaca(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400"
                    >
                      <Car className="h-3.5 w-3.5" />
                      <span>Asignar / Cambiar Placa</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Placa Vehicular */}
                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Placa Vehicular</p>
                    <p className="text-base font-bold font-mono text-gray-900 dark:text-white mt-0.5">
                      {empleado.movilidad?.placa_vehiculo || empleado.placa_vehiculo || "Sin placa asignada"}
                    </p>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      empleado.movilidad?.placa_vehiculo || empleado.placa_vehiculo
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {empleado.movilidad?.placa_vehiculo || empleado.placa_vehiculo ? "ASIGNADA" : "PENDIENTE"}
                    </span>
                  </div>

                  {/* Sabe Conducir */}
                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Habilidad de Conducción</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {empleado.movilidad?.sabe_conducir ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                            Sabe Conducir
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                          No Conduce
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {empleado.movilidad?.sabe_conducir ? "Autorizado para operar vehículo" : "Sin permiso de conducción"}
                    </p>
                  </div>

                  {/* Medio de Transporte */}
                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Medio de Transporte</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                      {empleado.movilidad?.medio_transporte
                        ? (empleado.movilidad.medio_transporte === "MOTO"
                            ? "Motocicleta"
                            : empleado.movilidad.medio_transporte === "CARRO"
                            ? "Automóvil / Camioneta"
                            : empleado.movilidad.medio_transporte === "TRANSPORTE_PUBLICO"
                            ? "Transporte Público"
                            : empleado.movilidad.medio_transporte === "A_PIE"
                            ? "A Pie"
                            : empleado.movilidad.medio_transporte)
                        : "No especificado"}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">Medio habitual de traslado</p>
                  </div>

                  {/* Modelo / Línea */}
                  <div className="rounded-xl border border-gray-100 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Modelo / Línea Vehicular</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5 truncate" title={empleado.movilidad?.modelo_vehiculo || "N/A"}>
                      {empleado.movilidad?.modelo_vehiculo || "No registrado"}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">Marca y especificación</p>
                  </div>
                </div>

                {/* Copia de Licencia de Conducción Adjunta */}
                {(() => {
                  const licDoc = empleado.documentos_adjuntos?.find(
                    (d) => d.tipo_documento === "LICENCIA_CONDUCCION" || d.tipo_documento === "LICENCIA"
                  );
                  return (
                    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                              Licencia de Conducción (Copia Digital)
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {licDoc ? "Documento digital verificado en el expediente" : "Aún no se ha adjuntado copia digital de la licencia de conducción."}
                            </p>
                          </div>
                        </div>

                        {licDoc ? (
                          <a
                            href={licDoc.archivo_url.startsWith("http") ? licDoc.archivo_url : `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}${licDoc.archivo_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Ver Documento</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              setSeccionEditar("movilidad");
                              setShowModalEditar(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>Adjuntar Licencia</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 5: CUENTAS & FAMILIA */}
            {activeTab === "cuentas" && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Cuentas Bancarias de Nómina
                    </h4>
                    <button
                      onClick={() => setShowModalCuenta(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Agregar Cuenta</span>
                    </button>
                  </div>

                  {(!empleado.cuentas_bancarias || empleado.cuentas_bancarias.length === 0) ? (
                    <p className="text-xs text-gray-400 italic">No hay cuentas bancarias registradas.</p>
                  ) : (
                    <div className="space-y-2">
                      {empleado.cuentas_bancarias.map((c) => (
                        <div
                          key={c.id || c.numero_cuenta}
                          className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900"
                        >
                          <div className="flex items-center gap-3">
                            <CreditCard className="h-5 w-5 text-indigo-500" />
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {c.banco} • {c.tipo_cuenta}
                              </p>
                              <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                Cuenta: {c.numero_cuenta} (12 dígitos estándar)
                              </p>
                            </div>
                          </div>
                          {c.es_nomina && (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                              Dispersión Nómina
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Contactos de Emergencia (Red de Apoyo)
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        Tabla 9: empleados_contactos_emergencia
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setContactoEmergenciaToEdit(null);
                        setShowModalContactoEmergencia(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Agregar Contacto</span>
                    </button>
                  </div>

                  {(!empleado.contactos_emergencia || empleado.contactos_emergencia.length === 0) ? (
                    <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 text-center dark:border-gray-800 dark:bg-gray-900/50">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 mb-2">
                        <PhoneCall className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        No hay contactos de emergencia registrados
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 mb-3">
                        Agregue un familiar o persona cercana para emergencias médicas o laborales.
                      </p>
                      <button
                        onClick={() => {
                          setContactoEmergenciaToEdit(null);
                          setShowModalContactoEmergencia(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-500"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Registrar Primer Contacto</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {empleado.contactos_emergencia.map((ce) => (
                        <div
                          key={ce.id}
                          className="relative flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {ce.nombre_completo || ce.nombre_contacto}
                              </span>
                              {ce.es_principal && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                  <span>Principal</span>
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-medium text-brand-600 dark:text-brand-400 mt-0.5">
                              {ce.parentesco}
                            </p>

                            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 mt-2 font-mono">
                              <Phone className="h-3.5 w-3.5 text-gray-400" />
                              <a
                                href={`tel:${ce.telefono || ce.telefono_principal}`}
                                className="hover:underline hover:text-brand-600"
                              >
                                {ce.telefono || ce.telefono_principal}
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-2 mt-3 border-t border-gray-100 dark:border-gray-800">
                            <button
                              onClick={() => {
                                setContactoEmergenciaToEdit(ce);
                                setShowModalContactoEmergencia(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Editar</span>
                            </button>
                            <button
                              disabled={isDeletingContacto === ce.id}
                              onClick={() => handleEliminarContactoEmergencia(ce.id)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 disabled:opacity-50"
                            >
                              {isDeletingContacto === ce.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 6: AUDITORIA */}
            {activeTab === "auditoria" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Bitácora de Trazabilidad y Auditoría
                  </h4>
                  {isLoadingAudit && (
                    <span className="text-xs text-gray-400 animate-pulse">Consultando historial...</span>
                  )}
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-800">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => {
                      const getActionBadge = () => {
                        switch (log.accion) {
                          case "CREACION":
                            return { color: "bg-brand-500", label: "Registro inicial en Base de Personal" };
                          case "ENTREGA_AREA":
                            return { color: "bg-emerald-500", label: "Entrega de Personal a Operaciones" };
                          case "ASIGNACION_PLACA":
                            return { color: "bg-amber-500", label: "Asignación de Vehículo / Movilidad" };
                          case "LIBERACION_PLACA":
                            return { color: "bg-orange-500", label: "Liberación de Vehículo" };
                          case "DESACTIVACION":
                            return { color: "bg-red-500", label: "Desactivación / Retiro de Colaborador" };
                          case "REACTIVACION":
                            return { color: "bg-purple-500", label: "Reactivación de Colaborador" };
                          case "CUENTA_BANCARIA":
                            return { color: "bg-indigo-500", label: "Gestión de Cuenta Bancaria" };
                          default:
                            return { color: "bg-gray-500", label: log.accion };
                        }
                      };
                      const badge = getActionBadge();

                      return (
                        <div key={log.id} className="relative">
                          <div className={`absolute -left-6 top-1 h-2.5 w-2.5 rounded-full ${badge.color} ring-4 ring-white dark:ring-gray-900`} />
                          <p className="text-xs font-bold text-gray-900 dark:text-white">
                            {badge.label}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Fecha: {formatFechaHora(log.created_at || log.fecha_evento)}
                            {log.usuario_nombre && ` • Por: ${log.usuario_nombre}`}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <>
                      <div className="relative">
                        <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white dark:ring-gray-900" />
                        <p className="text-xs font-bold text-gray-900 dark:text-white">
                          Registro inicial en Base de Personal
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Fecha: {formatFechaHora(empleado.created_at || (empleado as any).fecha_creacion)}
                        </p>
                      </div>
                      {(empleado.laboral?.fecha_entrega_area || (empleado.laboral as any)?.fecha_entrega_operaciones) && (
                        <div className="relative">
                          <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-gray-900" />
                          <p className="text-xs font-bold text-gray-900 dark:text-white">
                            Entrega de Personal a Operaciones
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Fecha: {formatFechaHora(empleado.laboral?.fecha_entrega_area || (empleado.laboral as any)?.fecha_entrega_operaciones)}
                          </p>
                        </div>
                      )}
                      {(empleado.laboral?.fecha_egreso || (empleado.laboral as any)?.fecha_retiro) && (
                        <div className="relative">
                          <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-4 ring-white dark:ring-gray-900" />
                          <p className="text-xs font-bold text-gray-900 dark:text-white">
                            Desactivación / Retiro de Colaborador
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Fecha: {formatFechaHora(empleado.laboral?.fecha_egreso || (empleado.laboral as any)?.fecha_retiro)}
                            {empleado.laboral?.motivo_retiro_gh && ` • Motivo: ${empleado.laboral.motivo_retiro_gh}`}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ID Interno: <strong className="font-mono text-gray-700 dark:text-gray-200">{empleado.id}</strong> • Antigüedad: <strong className="text-gray-800 dark:text-gray-100">{getDiasEnEmpresa()} días</strong>
            </span>
            <button
              onClick={onClose}
              className="rounded-lg bg-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cerrar Ficha
            </button>
          </div>
        </div>
      </div>

      {/* Sub Modals */}
      {showModalEditar && (
        <ModalEditarPerfil
          empleado={empleado}
          seccionInicial={seccionEditar}
          isOpen={showModalEditar}
          onClose={() => setShowModalEditar(false)}
          onSuccess={onRefresh}
        />
      )}
      {showModalCuenta && (
        <ModalCuentaBancaria
          empleado={empleado}
          isOpen={showModalCuenta}
          onClose={() => setShowModalCuenta(false)}
          onSuccess={onRefresh}
        />
      )}
      {showModalEntrega && (
        <ModalEntregaGH
          empleado={empleado}
          isOpen={showModalEntrega}
          onClose={() => setShowModalEntrega(false)}
          onSuccess={onRefresh}
        />
      )}
      {showModalPlaca && (
        <ModalAsignarPlaca
          empleado={empleado}
          isOpen={showModalPlaca}
          onClose={() => setShowModalPlaca(false)}
          onSuccess={onRefresh}
        />
      )}
      {showModalContactoEmergencia && (
        <ModalContactoEmergencia
          empleado={empleado}
          contactoToEdit={contactoEmergenciaToEdit}
          isOpen={showModalContactoEmergencia}
          onClose={() => {
            setShowModalContactoEmergencia(false);
            setContactoEmergenciaToEdit(null);
          }}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
};
