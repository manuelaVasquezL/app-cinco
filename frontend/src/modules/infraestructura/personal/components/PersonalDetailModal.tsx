"use client";

// src/modules/infraestructura/personal/components/PersonalDetailModal.tsx
import { API_BASE_URL } from "@/lib/apiConfig";
import { usePersonalStore } from "../store/usePersonalStore";

import React, { useState } from "react";
import {
  X,
  Camera,
  ZoomIn,
  Briefcase,
  User,
  Users,
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
  FileCheck,
  ExternalLink,
  Edit3,
  Upload,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { EmpleadoPerfilCompleto, EmpleadoAuditoriaLog, EmpleadoPersonaACargo, EmpleadoDotacionComprobante } from "@/types/empleado";
import { personalService } from "../services/personalService";
import { ModalCuentaBancaria } from "./ModalCuentaBancaria";
import { ModalContactoEmergencia } from "./ModalContactoEmergencia";
import { ModalPersonaACargo } from "./ModalPersonaACargo";
import { ModalConfirmarEliminacion } from "./ModalConfirmarEliminacion";
import { ModalEntregaGH } from "./ModalEntregaGH";
import { ModalAsignarPlaca } from "./ModalAsignarPlaca";
import { ModalEditarPerfil } from "./ModalEditarPerfil";
import { ModalSubirComprobanteDotacion } from "./ModalSubirComprobanteDotacion";


const resolveFotoUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/media/")) {
    const base = API_BASE_URL.replace(/\/+$/, "");
    return `${base}${url}`;
  }
  if (url.startsWith("photos/")) {
    return `https://www.cincosas.com/2mp21d4s/${url}`;
  }
  return url;
};

interface Props {
  empleado: EmpleadoPerfilCompleto | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

type TabKey = "laboral" | "datos" | "sst" | "movilidad" | "cuentas" | "auditoria";

const AUDIT_FIELD_LABELS: Record<string, string> = {
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  nombre_completo: 'Nombre Completo',
  tipo_documento: 'Tipo de Documento',
  numero_documento: 'Número de Documento',
  fecha_expedicion_documento: 'Fecha de Expedición Documento',
  fecha_nacimiento: 'Fecha de Nacimiento',
  genero: 'Género',
  estado_civil: 'Estado Civil',
  pasaporte: 'Pasaporte',
  estado: 'Estado General',
  foto_url: 'Fotografía',

  cargo: 'Cargo',
  area: 'Área',
  sede: 'Sede / Ciudad',
  movil: 'Móvil / Cuadrilla',
  puesto: 'Puesto de Trabajo',
  carpeta: 'Carpeta Operativa',
  tipo_labor: 'Tipo de Labor',
  zona_nodo: 'Zona / Nodo',
  codigo_sap: 'Código SAP',
  supervisor: 'Supervisor / Líder Directo',
  supervisor_id: 'Supervisor / Líder Directo',
  padrino: 'Padrino / Mentor de Inducción',
  padrino_id: 'Padrino / Mentor de Inducción',
  formador: 'Formador',
  grupo_comisiones: 'Grupo de Comisiones',
  nivel_estudio: 'Nivel de Estudio',
  etapa_induccion: 'Etapa de Inducción',
  fecha_ingreso: 'Fecha de Ingreso',
  fecha_entrega_area: 'Fecha Entrega a Operaciones',
  fecha_egreso: 'Fecha de Retiro / Egreso',
  motivo_retiro_gh: 'Motivo de Retiro',
  observaciones_retiro: 'Observaciones de Retiro',
  salario_base: 'Salario Base',
  funcion_cargo: 'Función del Cargo',
  practica_lectiva_inicio: 'Inicio Práctica Lectiva',
  practica_lectiva_fin: 'Fin Práctica Lectiva',
  practica_productiva_inicio: 'Inicio Práctica Productiva',
  practica_productiva_fin: 'Fin Práctica Productiva',

  celular_personal: 'Celular Personal',
  celular_corporativo: 'Celular Corporativo',
  celular_alterno: 'Celular Alterno',
  telefono_fijo: 'Teléfono Fijo',
  correo_personal: 'Correo Personal',
  correo_corporativo: 'Correo Corporativo',
  direccion_residencia: 'Dirección de Residencia',
  claro_pay: 'Claro Pay',

  permiso_trabajo: 'Permiso de Trabajo SST',
  vencimiento_alturas: 'Vencimiento Curso de Alturas',
  vencimiento_tecnico: 'Vencimiento Examen Técnico/Médico',
  certificado_alturas_url: 'Certificado de Alturas (Archivo)',
  certificado_tecnico_url: 'Certificado Técnico (Archivo)',

  tiene_carnet: 'Posee Carnet',
  fecha_entrega_carnet: 'Fecha Entrega de Carnet',
  talla_camisa: 'Talla de Camisa',
  talla_pantalon: 'Talla de Pantalón',
  talla_calzado: 'Talla de Calzado',
  talla_chaqueta: 'Talla de Chaqueta',
  talla_guerrera: 'Talla de Guerrera',

  placa_vehiculo: 'Placa del Vehículo',
  modelo_vehiculo: 'Modelo del Vehículo',
  medio_transporte: 'Medio de Transporte',
  sabe_conducir: 'Sabe Conducir',

  eps: 'EPS',
  arl: 'ARL',
  afp: 'Fondo de Pensiones (AFP)',
  esquema_vacunacion: 'Esquema de Vacunación',
};

const formatAuditVal = (val: unknown): string => {
  if (val === null || val === undefined) return '(Vacío)';
  const str = String(val).trim();
  if (str === '' || str === 'None' || str === 'null' || str === 'undefined') return '(Vacío)';
  if (str === 'true' || str === 'SI' || val === true) return 'SÍ';
  if (str === 'false' || str === 'NO' || val === false) return 'NO';
  return str;
};

interface AuditDiffItem {
  campo: string;
  label: string;
  valorAnterior: string;
  valorNuevo: string;
}

const extractAuditDiffs = (
  datosAntes?: Record<string, unknown> | null,
  datosNuevos?: Record<string, unknown> | null
): AuditDiffItem[] => {
  const antes = datosAntes || {};
  const nuevos = datosNuevos || {};
  const allKeys = Array.from(new Set([...Object.keys(antes), ...Object.keys(nuevos)]));
  const diffs: AuditDiffItem[] = [];

  for (const key of allKeys) {
    if (['id', 'empleado_id', 'created_at', 'updated_at', 'user', 'password'].includes(key)) {
      continue;
    }

    const valAntRaw = antes[key];
    const valNueRaw = nuevos[key];

    const strAnt = formatAuditVal(valAntRaw);
    const strNue = formatAuditVal(valNueRaw);

    if (strAnt === strNue) {
      continue;
    }

    diffs.push({
      campo: key,
      label: AUDIT_FIELD_LABELS[key] || key.replace(/_/g, ' ').toUpperCase(),
      valorAnterior: strAnt,
      valorNuevo: strNue,
    });
  }

  return diffs.sort((a, b) => a.label.localeCompare(b.label));
};

export const PersonalDetailModal: React.FC<Props> = ({
  empleado,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>("laboral");
  const [isUploadingFoto, setIsUploadingFoto] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setImgError(false);
  }, [empleado?.id, empleado?.foto_url]);

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !empleado) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato no válido. Debe seleccionar una imagen JPG, PNG o WebP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen supera el tamaño máximo permitido de 5 MB.");
      return;
    }

    setIsUploadingFoto(true);
    try {
      const res = await personalService.subirFotoPerfil(empleado.id, file);
      toast.success(res.message || "Fotografía actualizada exitosamente.");
      setImgError(false);
      usePersonalStore.getState().updateLocalItem({
        ...empleado,
        foto_url: res.foto_url,
      });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al subir la fotografía.");
    } finally {
      setIsUploadingFoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const [showModalCuenta, setShowModalCuenta] = useState(false);
  const [showModalEntrega, setShowModalEntrega] = useState(false);
  const [showModalPlaca, setShowModalPlaca] = useState(false);
  const [showModalContactoEmergencia, setShowModalContactoEmergencia] = useState(false);
  const [contactoEmergenciaToEdit, setContactoEmergenciaToEdit] = useState<any>(null);
  const [showModalPersonaACargo, setShowModalPersonaACargo] = useState(false);
  const [personaACargoToEdit, setPersonaACargoToEdit] = useState<EmpleadoPersonaACargo | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{
    tipo: "contacto" | "persona";
    id: number;
    nombre: string;
    detalle?: string;
  } | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const handleConfirmarEliminacion = async () => {
    if (!itemToDelete || !empleado?.id) return;
    setIsDeletingItem(true);
    try {
      if (itemToDelete.tipo === "contacto") {
        await personalService.eliminarContactoEmergencia(empleado.id, itemToDelete.id);
        toast.success(`Contacto ${itemToDelete.nombre} eliminado.`);
      } else {
        await personalService.eliminarPersonaACargo(empleado.id, itemToDelete.id);
        toast.success(`Beneficiario(a) ${itemToDelete.nombre} eliminado.`);
      }
      setItemToDelete(null);
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al eliminar registro";
      toast.error(msg);
    } finally {
      setIsDeletingItem(false);
    }
  };

  const [showModalEditar, setShowModalEditar] = useState(false);
  const [seccionEditar, setSeccionEditar] = useState<"laboral" | "contacto" | "sst" | "dotacion" | "movilidad">("laboral");
  const [showModalSubirComprobanteDotacion, setShowModalSubirComprobanteDotacion] = useState(false);
  const [comprobanteAEliminar, setComprobanteAEliminar] = useState<EmpleadoDotacionComprobante | null>(null);
  const [isDeletingComprobante, setIsDeletingComprobante] = useState(false);

  const handleSubirComprobanteSuccess = (nuevoComprobante: EmpleadoDotacionComprobante) => {
    if (empleado) {
      const actualizados = [nuevoComprobante, ...(empleado.comprobantes_dotacion || [])];
      usePersonalStore.getState().updateLocalItem({
        ...empleado,
        comprobantes_dotacion: actualizados,
      });
      usePersonalStore.getState().fetchEmpleadoDetail(empleado.id);
      if (onRefresh) onRefresh();
    }
  };

  const handleConfirmarEliminarComprobante = (comp: EmpleadoDotacionComprobante) => {
    setComprobanteAEliminar(comp);
  };

  const handleEjecutarEliminarComprobante = async () => {
    if (!empleado || !comprobanteAEliminar) return;
    setIsDeletingComprobante(true);
    try {
      await personalService.eliminarComprobanteDotacion(empleado.id, comprobanteAEliminar.id);
      toast.success("Comprobante de dotación eliminado exitosamente.");
      const filtrados = (empleado.comprobantes_dotacion || []).filter(
        (c) => c.id !== comprobanteAEliminar.id
      );
      usePersonalStore.getState().updateLocalItem({
        ...empleado,
        comprobantes_dotacion: filtrados,
      });
      usePersonalStore.getState().fetchEmpleadoDetail(empleado.id);
      if (onRefresh) onRefresh();
      setComprobanteAEliminar(null);
    } catch (err: any) {
      console.error("Error al eliminar comprobante:", err);
      toast.error(err.response?.data?.error || "Error al eliminar el comprobante de dotación.");
    } finally {
      setIsDeletingComprobante(false);
    }
  };
  const [auditLogs, setAuditLogs] = useState<EmpleadoAuditoriaLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<string | number, boolean>>({});

  const toggleLogExpanded = (logKey: string | number) => {
    setExpandedLogs((prev) => ({
      ...prev,
      [logKey]: !prev[logKey],
    }));
  };

  const contentBodyRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (contentBodyRef.current) {
      contentBodyRef.current.scrollTop = 0;
    }
  }, [activeTab]);

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
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden animate-fade-in">
        {/* Overlay con fondo claro difuminado idéntico a Operaciones (Actividades / Agenda) */}
        <div
          className="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px] dark:bg-black/60 cursor-pointer"
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="relative flex flex-col w-full max-w-4xl h-[88vh] max-h-[88vh] rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-4">
              <div className="relative group flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-lg font-bold text-white shadow-md">
                {resolveFotoUrl(empleado.foto_url || empleado.foto_perfil_url) && !imgError ? (
                  <img
                    src={resolveFotoUrl(empleado.foto_url || empleado.foto_perfil_url)}
                    alt={empleado.nombre_completo}
                    className="h-full w-full rounded-2xl object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                    onClick={() => setIsZoomOpen(true)}
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span className="cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    {getInitials()}
                  </span>
                )}

                {/* Botón flotante para cambiar foto (siempre visible) */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Subir / Cambiar Fotografía del Colaborador"
                  disabled={isUploadingFoto}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white shadow-md hover:bg-brand-500 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isUploadingFoto ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Camera className="h-3 w-3" />
                  )}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFotoChange}
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {empleado.nombre_completo}
                  </h2>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${empleado.estado === "ACTIVO"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                        : empleado.estado === "EN_FORMACION"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                  >
                    {empleado.estado}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {empleado.tipo_documento} {empleado.numero_documento} • {empleado.laboral?.cargo || "Sin cargo asignado"} • {empleado.laboral?.ciudad_operacion || "Sin ciudad"}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFoto}
                    className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-brand-500/10 dark:hover:text-brand-400 transition-colors cursor-pointer"
                    title="Subir nueva fotografía de perfil"
                  >
                    <Upload className="h-3 w-3" />
                    <span>{isUploadingFoto ? "Subiendo..." : "Subir Foto"}</span>
                  </button>
                  {resolveFotoUrl(empleado.foto_url || empleado.foto_perfil_url) && !imgError && (
                    <button
                      type="button"
                      onClick={() => setIsZoomOpen(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400 hover:underline cursor-pointer"
                      title="Ver fotografía en tamaño completo"
                    >
                      <ZoomIn className="h-3 w-3" />
                      <span>Ver Foto</span>
                    </button>
                  )}
                </div>
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
          <div className="shrink-0 border-b border-gray-100 px-6 overflow-x-auto dark:border-gray-800 scrollbar-none bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between min-w-[760px] pb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex shrink-0 items-center gap-1.5 py-3 px-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${activeTab === tab.key
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
          <div ref={contentBodyRef} className="flex-1 min-h-0 p-5 sm:p-6 overflow-y-auto space-y-6">
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
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${isCurrent
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${empleado.laboral?.tipo_labor === 'SUPERVISOR'
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
                    <p className="text-xs text-gray-500 dark:text-gray-400">Periodo de Prueba (2 Meses)</p>
                    <div className="mt-1 flex items-center gap-2">
                      {empleado.laboral?.dias_para_periodo_prueba !== undefined && empleado.laboral?.dias_para_periodo_prueba !== null ? (
                        empleado.laboral.dias_para_periodo_prueba >= 0 ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                              empleado.laboral.dias_para_periodo_prueba > 30
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400"
                                : empleado.laboral.dias_para_periodo_prueba > 15
                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400"
                                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-500/10 dark:text-rose-400"
                            }`}
                          >
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {empleado.laboral.dias_para_periodo_prueba} días restantes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Superado ({Math.abs(empleado.laboral.dias_para_periodo_prueba)} días)
                          </span>
                        )
                      ) : (
                        <span className="text-sm font-semibold text-gray-500">N/A</span>
                      )}
                    </div>
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

                      <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-800 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Riesgos Laborales (ARL)</p>
                            {(empleado.seguridad_social?.certificado_arl_url ||
                              empleado.documentos_adjuntos?.find((d) => d.tipo_documento === "CERTIFICADO_ARL" || d.tipo_documento === "ARL")?.archivo_url) && (
                                <a
                                  href={getMediaUrl(
                                    empleado.seguridad_social?.certificado_arl_url ||
                                    empleado.documentos_adjuntos?.find((d) => d.tipo_documento === "CERTIFICADO_ARL" || d.tipo_documento === "ARL")?.archivo_url
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-2xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span>Ver Certificado</span>
                                </a>
                              )}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                            {empleado.seguridad_social?.arl || "COLMENA"}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          {empleado.seguridad_social?.certificado_arl_url ||
                          empleado.documentos_adjuntos?.some((d) => d.tipo_documento === "CERTIFICADO_ARL" || d.tipo_documento === "ARL")
                            ? "Certificado adjunto en expediente"
                            : "Sin certificado digital adjunto"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Certificaciones y Vencimientos */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Aptitud y Certificaciones Operativas</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

                      {/* Coordinador de Alturas */}
                      <div className="rounded-lg border border-gray-200/60 p-3 dark:border-gray-800 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Coordinador Alturas</p>
                            {((empleado.certificaciones_sst || empleado.sst)?.certificado_coordinador_url ||
                              empleado.documentos_adjuntos?.find((d) => d.tipo_documento === "CERTIFICADO_COORDINADOR" || d.tipo_documento === "COORDINADOR")?.archivo_url) && (
                                <a
                                  href={getMediaUrl(
                                    (empleado.certificaciones_sst || empleado.sst)?.certificado_coordinador_url ||
                                    empleado.documentos_adjuntos?.find((d) => d.tipo_documento === "CERTIFICADO_COORDINADOR" || d.tipo_documento === "COORDINADOR")?.archivo_url
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
                            {(() => {
                              const sst = empleado.certificaciones_sst || empleado.sst;
                              const estado = sst?.estado_coordinador;
                              if (!estado || estado === "NO_APLICA") {
                                return (sst?.certificado_coordinador_url ? "Certificado" : "No aplica");
                              }
                              if (estado === "VIGENTE") return "Vigente";
                              if (estado === "POR_VENCER") return "Por Vencer";
                              if (estado === "VENCIDO") return "Vencido";
                              return estado;
                            })()}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Vence: {(empleado.certificaciones_sst || empleado.sst)?.vencimiento_coordinador || "N/A"}
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

                {/* 4. Comprobantes y Actas Físicas de Dotación */}
                <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-brand-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Comprobantes y Actas Físicas de Entrega de Dotación
                      </h4>
                      <span className="inline-flex items-center justify-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                        {empleado.comprobantes_dotacion?.length || 0}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowModalSubirComprobanteDotacion(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Cargar Comprobante</span>
                    </button>
                  </div>

                  {/* Listado de Comprobantes */}
                  {(!empleado.comprobantes_dotacion || empleado.comprobantes_dotacion.length === 0) ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 p-6 text-center dark:border-gray-800">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500 mb-2">
                        <FileText className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        No hay actas o comprobantes de entrega de dotación cargados
                      </p>
                      <p className="text-[11px] text-gray-400 max-w-sm mt-0.5">
                        Cargue el comprobante físico firmado por el colaborador como constancia de la entrega de prendas o elementos de protección personal.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowModalSubirComprobanteDotacion(true)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Cargar Primer Comprobante</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {empleado.comprobantes_dotacion.map((comp) => {
                        const isPdf = comp.archivo_url?.toLowerCase().endsWith(".pdf");
                        return (
                          <div
                            key={comp.id}
                            className="flex flex-col justify-between rounded-xl border border-gray-200/70 bg-gray-50/50 p-3 hover:border-brand-200 transition-all dark:border-gray-800 dark:bg-gray-800/40"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                  isPdf
                                    ? "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                                    : "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                                }`}>
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                                      Entrega: {comp.fecha_entrega}
                                    </span>
                                  </div>
                                  {comp.subido_por_nombre && (
                                    <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                      Por: {comp.subido_por_nombre}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleConfirmarEliminarComprobante(comp)}
                                className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400 transition-colors"
                                title="Eliminar comprobante"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {comp.observaciones && (
                              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300 italic line-clamp-2 bg-white/70 dark:bg-gray-800/80 p-1.5 rounded-md border border-gray-100 dark:border-gray-700/50">
                                &ldquo;{comp.observaciones}&rdquo;
                              </p>
                            )}

                            <div className="mt-3 pt-2 border-t border-gray-200/50 dark:border-gray-800 flex items-center justify-between">
                              <span className="text-[10px] text-gray-400">
                                {comp.created_at ? new Date(comp.created_at).toLocaleDateString() : ""}
                              </span>
                              <a
                                href={getMediaUrl(comp.archivo_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline"
                              >
                                <span>Ver comprobante</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: MOVILIDAD & FLOTA */}
            {activeTab === "movilidad" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Vehículo Asignado y Movilidad
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
                    <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${empleado.movilidad?.placa_vehiculo || empleado.placa_vehiculo
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
                      Cuentas Bancarias
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
                                Cuenta: {c.numero_cuenta}
                              </p>
                            </div>
                          </div>
                          {c.es_nomina && (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                              Cuenta de Nómina
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
                        Contactos de Emergencia
                      </h4>
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
                              onClick={() => {
                                if (!ce.id) return;
                                setItemToDelete({
                                  tipo: "contacto",
                                  id: ce.id,
                                  nombre: ce.nombre_completo || ce.nombre_contacto || "Contacto de emergencia",
                                  detalle: `Parentesco: ${ce.parentesco} • Tel: ${ce.telefono || ce.telefono_principal || "Sin registrar"}`,
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SECCIÓN 3: PERSONAS A CARGO / BENEFICIARIOS */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Personas a Cargo
                      </h4>
                    </div>
                    <button
                      onClick={() => {
                        setPersonaACargoToEdit(null);
                        setShowModalPersonaACargo(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-600 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Agregar Persona a Cargo</span>
                    </button>
                  </div>

                  {(!empleado.personas_a_cargo || empleado.personas_a_cargo.length === 0) ? (
                    <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 text-center dark:border-gray-800 dark:bg-gray-900/50">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400 mb-2">
                        <Users className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        No hay personas a cargo registradas
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 mb-3">
                        Registre a los beneficiarios legales o núcleo familiar dependiente del colaborador.
                      </p>
                      <button
                        onClick={() => {
                          setPersonaACargoToEdit(null);
                          setShowModalPersonaACargo(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-violet-500"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Registrar Primer Beneficiario</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {empleado.personas_a_cargo.map((pa) => (
                        <div
                          key={pa.id}
                          className="relative flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-3.5 shadow-xs dark:border-gray-800 dark:bg-gray-900"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {pa.nombre_completo}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-400">
                                {pa.parentesco}
                              </span>
                            </div>

                            <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                              {pa.numero_documento ? (
                                <p className="font-mono text-[11px]">
                                  <span className="text-gray-400">{pa.tipo_documento || "DOC"}:</span> {pa.numero_documento}
                                </p>
                              ) : (
                                <p className="text-[11px] text-gray-400 italic">Documento no registrado</p>
                              )}

                              {pa.fecha_nacimiento && (
                                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                                  <Calendar className="h-3 w-3 text-gray-400" />
                                  <span>Nacimiento: {pa.fecha_nacimiento}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-2 mt-3 border-t border-gray-100 dark:border-gray-800">
                            <button
                              onClick={() => {
                                setPersonaACargoToEdit(pa);
                                setShowModalPersonaACargo(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Editar</span>
                            </button>
                            <button
                              onClick={() => {
                                if (!pa.id) return;
                                setItemToDelete({
                                  tipo: "persona",
                                  id: pa.id,
                                  nombre: pa.nombre_completo,
                                  detalle: `Parentesco: ${pa.parentesco}${pa.numero_documento ? ` • ${pa.tipo_documento || "DOC"}: ${pa.numero_documento}` : ""}`,
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <Trash2 className="h-3 w-3" />
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
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Bitácora de Trazabilidad y Auditoría
                    </h4>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      Historial detallado campo por campo de modificaciones realizadas al colaborador.
                    </p>
                  </div>
                  {isLoadingAudit && (
                    <span className="text-xs text-gray-400 animate-pulse">Consultando historial...</span>
                  )}
                </div>

                <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-800">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log, index) => {
                      const getActionBadge = () => {
                        switch (log.accion) {
                          case "CREACION":
                            return { color: "bg-brand-500", label: "Registro inicial en Base de Personal" };
                          case "ACTUALIZACION_PERFIL":
                            return { color: "bg-blue-500", label: "Actualización de Datos Personales" };
                          case "ACTUALIZACION_LABORAL":
                            return { color: "bg-indigo-500", label: "Actualización de Información Laboral" };
                          case "ACTUALIZACION_CONTACTO":
                            return { color: "bg-teal-500", label: "Actualización de Datos de Contacto" };
                          case "ACTUALIZACION_SEGURIDAD_SOCIAL":
                            return { color: "bg-cyan-600", label: "Actualización de Seguridad Social" };
                          case "ACTUALIZACION_SST":
                            return { color: "bg-amber-500", label: "Actualización de Certificaciones SST" };
                          case "ACTUALIZACION_DOTACION":
                            return { color: "bg-purple-500", label: "Actualización de Dotación y Tallas" };
                          case "ACTUALIZACION_MOVILIDAD":
                            return { color: "bg-emerald-600", label: "Actualización de Movilidad" };
                          case "ENTREGA_AREA":
                            return { color: "bg-emerald-500", label: "Entrega de Personal a Operaciones" };
                          case "ASIGNACION_PLACA":
                            return { color: "bg-amber-500", label: "Asignación de Vehículo / Placa" };
                          case "LIBERACION_PLACA":
                            return { color: "bg-orange-500", label: "Liberación de Vehículo / Placa" };
                          case "DESACTIVACION":
                            return { color: "bg-red-500", label: "Desactivación / Retiro de Colaborador" };
                          case "DESVINCULACION_CUADRILLA_AUTOMATICA":
                            return { color: "bg-amber-600", label: "Desvinculación Automática de Cuadrilla (TIRAN)" };
                          case "HERENCIA_CUADRILLA_AUXILIAR":
                            return { color: "bg-blue-600", label: "Auto-herencia de Cuadrilla (Auxiliar)" };
                          case "SINCRONIZACION_CUADRILLA":
                            return { color: "bg-teal-600", label: "Sincronización de Cuadrilla (Técnico)" };
                          case "DESVINCULACION_CUADRILLA":
                            return { color: "bg-amber-600", label: "Desvinculación de Cuadrilla" };
                          case "REACTIVACION":
                            return { color: "bg-purple-500", label: "Reactivación de Colaborador" };
                          case "CUENTA_BANCARIA":
                            return { color: "bg-indigo-500", label: "Gestión de Cuenta Bancaria" };
                          case "CREACION_CONTACTO_EMERGENCIA":
                            return { color: "bg-rose-500", label: "Registro de Contacto de Emergencia" };
                          case "ACTUALIZACION_CONTACTO_EMERGENCIA":
                            return { color: "bg-rose-500", label: "Actualización de Contacto de Emergencia" };
                          case "ELIMINACION_CONTACTO_EMERGENCIA":
                            return { color: "bg-red-500", label: "Eliminación de Contacto de Emergencia" };
                          case "CREACION_PERSONA_A_CARGO":
                            return { color: "bg-violet-500", label: "Registro de Persona a Cargo" };
                          case "ACTUALIZACION_PERSONA_A_CARGO":
                            return { color: "bg-violet-500", label: "Actualización de Persona a Cargo" };
                          case "ELIMINACION_PERSONA_A_CARGO":
                            return { color: "bg-red-500", label: "Eliminación de Persona a Cargo" };
                          default:
                            return { color: "bg-gray-500", label: log.accion.replace(/_/g, " ") };
                        }
                      };

                      const badge = getActionBadge();
                      const diffs = extractAuditDiffs(log.datos_anteriores, log.datos_nuevos);
                      const logKey = log.id || index;
                      const isExpanded = expandedLogs[logKey] ?? (diffs.length > 0 && diffs.length <= 4);

                      return (
                        <div key={logKey} className="relative group">
                          <div className={`absolute -left-6 top-1 h-2.5 w-2.5 rounded-full ${badge.color} ring-4 ring-white dark:ring-gray-900 shadow-xs`} />

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-bold text-gray-900 dark:text-white">
                              {badge.label}
                            </p>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                              {formatFechaHora(log.created_at || (log as any).fecha_evento)}
                            </span>
                          </div>

                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {log.usuario_nombre ? `Editado por: ${log.usuario_nombre}` : "Sistema"}
                          </p>

                          {/* TABLA COMPARATIVA DE CAMBIOS - TAL CUAL COMO EN EL LEGACY */}
                          {diffs.length > 0 ? (
                            <div className="mt-2.5 space-y-2">
                              <button
                                type="button"
                                onClick={() => toggleLogExpanded(logKey)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                              >
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                <span>
                                  {isExpanded
                                    ? "Ocultar detalle de cambios"
                                    : `Ver ${diffs.length} campo${diffs.length === 1 ? "" : "s"} modificado${diffs.length === 1 ? "" : "s"}`}
                                </span>
                              </button>

                              {isExpanded && (
                                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900/90 shadow-xs">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead>
                                        <tr className="border-b border-gray-200 bg-gray-50/90 dark:border-gray-800 dark:bg-gray-800/80 font-bold uppercase tracking-wider text-[10px] text-gray-500 dark:text-gray-400">
                                          <th className="py-2 px-3 w-[30%]">CAMPO</th>
                                          <th className="py-2 px-3 w-[35%]">ANTERIOR</th>
                                          <th className="py-2 px-3 w-[35%]">NUEVO</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                                        {diffs.map((diff, dIdx) => (
                                          <tr key={dIdx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                                            <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200 align-middle">
                                              {diff.label}
                                            </td>
                                            <td className="py-2 px-3 align-middle">
                                              <span
                                                className={`inline-block max-w-full break-words rounded-md px-2 py-1 text-xs font-medium ${diff.valorAnterior === "(Vacío)"
                                                    ? "text-gray-400 italic bg-gray-100/70 dark:bg-gray-800/60"
                                                    : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200/80 dark:border-red-900/60"
                                                  }`}
                                              >
                                                {diff.valorAnterior}
                                              </span>
                                            </td>
                                            <td className="py-2 px-3 align-middle">
                                              <span
                                                className={`inline-block max-w-full break-words rounded-md px-2 py-1 text-xs font-medium ${diff.valorNuevo === "(Vacío)"
                                                    ? "text-gray-400 italic bg-gray-100/70 dark:bg-gray-800/60"
                                                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/60"
                                                  }`}
                                              >
                                                {diff.valorNuevo}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : log.accion === "CREACION" && log.datos_nuevos ? (
                            <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50/70 p-2.5 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
                              <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">Valores registrados inicialmente:</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                                {Object.entries(log.datos_nuevos).map(([k, v]) => (
                                  <div key={k} className="flex items-center gap-1.5 truncate">
                                    <span className="font-medium text-gray-500 dark:text-gray-400">{AUDIT_FIELD_LABELS[k] || k}:</span>
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">{formatAuditVal(v)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
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
          <div className="shrink-0 flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50">
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
      {showModalPersonaACargo && empleado && (
        <ModalPersonaACargo
          empleado={empleado}
          personaToEdit={personaACargoToEdit}
          isOpen={showModalPersonaACargo}
          onClose={() => {
            setShowModalPersonaACargo(false);
            setPersonaACargoToEdit(null);
          }}
          onSuccess={onRefresh}
        />
      )}
      {itemToDelete && (
        <ModalConfirmarEliminacion
          isOpen={!!itemToDelete}
          titulo={
            itemToDelete.tipo === "contacto"
              ? "¿Eliminar Contacto de Emergencia?"
              : "¿Eliminar Persona a Cargo?"
          }
          mensaje={
            itemToDelete.tipo === "contacto"
              ? "¿Está seguro de eliminar este contacto de la red de apoyo? Esta acción generará una traza en la bitácora de auditoría."
              : "¿Está seguro de eliminar este beneficiario del núcleo familiar? Esta acción generará una traza en la bitácora de auditoría."
          }
          nombreElemento={itemToDelete.nombre}
          detalle={itemToDelete.detalle}
          textoBotonConfirmar="Sí, Eliminar"
          isLoading={isDeletingItem}
          onClose={() => {
            if (!isDeletingItem) setItemToDelete(null);
          }}
          onConfirm={handleConfirmarEliminacion}
        />
      )}

      {/* Modal Subir Comprobante de Dotación */}
      {showModalSubirComprobanteDotacion && (
        <ModalSubirComprobanteDotacion
          empleado={empleado}
          isOpen={showModalSubirComprobanteDotacion}
          onClose={() => setShowModalSubirComprobanteDotacion(false)}
          onSuccess={handleSubirComprobanteSuccess}
        />
      )}

      {/* Modal Confirmar Eliminación de Comprobante de Dotación */}
      {comprobanteAEliminar && (
        <ModalConfirmarEliminacion
          isOpen={!!comprobanteAEliminar}
          titulo="Eliminar Comprobante de Dotación"
          mensaje={`¿Está seguro de que desea eliminar el comprobante de entrega con fecha ${comprobanteAEliminar.fecha_entrega}? Esta acción también eliminará el archivo físico del servidor.`}
          nombreElemento={comprobanteAEliminar.observaciones || `Comprobante #${comprobanteAEliminar.id}`}
          detalle={comprobanteAEliminar.archivo_url.split("/").pop()}
          textoBotonConfirmar="Sí, Eliminar"
          isLoading={isDeletingComprobante}
          onClose={() => {
            if (!isDeletingComprobante) setComprobanteAEliminar(null);
          }}
          onConfirm={handleEjecutarEliminarComprobante}
        />
      )}

      {/* Modal Zoom Foto (Equivalente zoom_img_ruta del Legacy) */}
      {isZoomOpen && resolveFotoUrl(empleado.foto_url || empleado.foto_perfil_url) && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs transition-opacity"
          onClick={() => setIsZoomOpen(false)}
        >
          <div
            className="relative max-w-lg w-full rounded-2xl bg-white p-4 shadow-2xl dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {empleado.nombre_completo}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {empleado.tipo_documento} {empleado.numero_documento}
                </p>
              </div>
              <button
                onClick={() => setIsZoomOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-center overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-800 max-h-[65vh]">
              <img
                src={resolveFotoUrl(empleado.foto_url || empleado.foto_perfil_url)}
                alt={empleado.nombre_completo}
                className="max-h-[65vh] w-auto object-contain rounded-xl"
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">
                {empleado.laboral?.cargo || "Fotografía de colaborador"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsZoomOpen(false);
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Cambiar foto</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};
