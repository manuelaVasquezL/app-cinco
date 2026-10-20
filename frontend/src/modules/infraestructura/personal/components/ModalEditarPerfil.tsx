// src/modules/infraestructura/personal/components/ModalEditarPerfil.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Save, Loader2, Mail, Shield, Shirt, MapPin, User, FileText, Upload, ExternalLink, CheckCircle2, Briefcase, Building2, Calendar, Phone, Car, Trash2 } from "lucide-react";
import DatePicker from "@/components/form/date-picker";
import { toast } from "sonner";
import { EmpleadoPerfilCompleto, EmpleadoDocumentoAdjunto } from "@/types/empleado";
import { personalService } from "../services/personalService";
import { usePersonalStore } from "../store/usePersonalStore";

interface Props {
  empleado: EmpleadoPerfilCompleto;
  seccionInicial?: "laboral" | "contacto" | "sst" | "dotacion" | "movilidad";
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const EPS_COLOMBIA = [
  "SURA",
  "SANITAS",
  "SALUD TOTAL",
  "NUEVA EPS",
  "COMPENSAR",
  "FAMISANAR",
  "COOSALUD",
  "SAVIA SALUD",
  "MUTUAL SER",
  "ASMET SALUD",
  "OTRA",
];

const ARL_COLOMBIA = [
  "COLMENA",
  "POSITIVA",
  "SURA",
  "SEGUROS BOLIVAR",
  "AXA COLPATRIA",
  "LA EQUIDAD",
];

const AFP_COLOMBIA = [
  "PORVENIR",
  "PROTECCION",
  "COLPENSIONES",
  "SKANDIA",
  "COLFONDOS",
];

const SEDES_COLOMBIA = [
  "MEDELLIN",
  "BOGOTA",
  "CALI",
  "CAUCASIA",
  "MONTERIA",
  "ORIENTE",
  "SINCELEJO",
  "TARAZA",
  "YARUMAL",
];

const NIVELES_ESTUDIO = [
  "PRIMARIA",
  "BACHILLER",
  "TECNICO",
  "TECNOLOGO",
  "PROFESIONAL",
  "ESPECIALIZACION",
  "MAESTRIA",
  "OTRO",
];


const toDateOrUndefined = (value?: string | null): Date | undefined => {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12);
};

export const ModalEditarPerfil: React.FC<Props> = ({
  empleado,
  seccionInicial = "contacto",
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { fetchEmpleadoDetail, updateLocalItem, supervisores, fetchSupervisores } = usePersonalStore();
  const [activeTab, setActiveTab] = useState<"laboral" | "contacto" | "sst" | "dotacion" | "movilidad">(seccionInicial);

  React.useEffect(() => {
    if (!supervisores || supervisores.length === 0) {
      fetchSupervisores();
    }
  }, [supervisores, fetchSupervisores]);

  // Form State: Información Laboral (Tabla 2: empleados_laboral)
  const [cargo, setCargo] = useState(empleado.laboral?.cargo || "");
  const [tipoLabor, setTipoLabor] = useState(empleado.laboral?.tipo_labor || "OPERATIVO");
  const [sede, setSede] = useState(empleado.laboral?.sede || "MEDELLIN");
  const [area, setArea] = useState(empleado.laboral?.area || "");
  const [carpeta, setCarpeta] = useState(empleado.laboral?.carpeta || "");
  const [codigoSap, setCodigoSap] = useState(empleado.laboral?.codigo_sap || "");
  const [puesto, setPuesto] = useState(empleado.laboral?.puesto || "");
  const [movil, setMovil] = useState(empleado.laboral?.movil || "");
  const [funcionCargo, setFuncionCargo] = useState(empleado.laboral?.funcion_cargo || "");
  const [zonaNodo, setZonaNodo] = useState(empleado.laboral?.zona_nodo || "");
  const [supervisorId, setSupervisorId] = useState<string>(
    empleado.laboral?.supervisor ? String(empleado.laboral.supervisor) : ""
  );
  const [padrinoId, setPadrinoId] = useState<string>(
    empleado.laboral?.padrino ? String(empleado.laboral.padrino) : ""
  );
  const [formador, setFormador] = useState(empleado.laboral?.formador || "");
  const [grupoComisiones, setGrupoComisiones] = useState(empleado.laboral?.grupo_comisiones || "");
  const [nivelEstudio, setNivelEstudio] = useState(empleado.laboral?.nivel_estudio || "");
  const [fechaIngreso, setFechaIngreso] = useState(empleado.laboral?.fecha_ingreso || "");
  const [etapaInduccion, setEtapaInduccion] = useState(empleado.laboral?.etapa_induccion || "EN_FORMACION");

  // Aprendices SENA / Prácticas
  const [practicaLectivaInicio, setPracticaLectivaInicio] = useState(
    empleado.laboral?.practica_lectiva_inicio || ""
  );
  const [practicaLectivaFin, setPracticaLectivaFin] = useState(
    empleado.laboral?.practica_lectiva_fin || ""
  );
  const [practicaProductivaInicio, setPracticaProductivaInicio] = useState(
    empleado.laboral?.practica_productiva_inicio || ""
  );
  const [practicaProductivaFin, setPracticaProductivaFin] = useState(
    empleado.laboral?.practica_productiva_fin || ""
  );

  // Form State: Identidad y Documentos (Tabla 1: empleados_perfil)
  const [nombres, setNombres] = useState(
    empleado.nombres || [empleado.primer_nombre, empleado.segundo_nombre].filter(Boolean).join(" ") || ""
  );
  const [apellidos, setApellidos] = useState(
    empleado.apellidos || [empleado.primer_apellido, empleado.segundo_apellido].filter(Boolean).join(" ") || ""
  );
  const [tipoDoc, setTipoDoc] = useState(
    empleado.tipo_documento || "CC"
  );
  const [numeroDoc, setNumeroDoc] = useState(
    empleado.numero_documento || ""
  );
  const [fechaExpedicionDoc, setFechaExpedicionDoc] = useState(
    empleado.fecha_expedicion_documento || empleado.fecha_expedicion_doc || ""
  );
  const [pasaporte, setPasaporte] = useState(
    empleado.pasaporte || ""
  );
  const [fechaNacimiento, setFechaNacimiento] = useState(
    empleado.fecha_nacimiento || ""
  );
  const [genero, setGenero] = useState(
    empleado.genero || ""
  );
  const [estadoCivil, setEstadoCivil] = useState(
    empleado.estado_civil || ""
  );

  type TipoDocAdjunto =
    | "CEDULA_FRONTAL"
    | "CEDULA_POSTERIOR"
    | "CERTIFICADO_ALTURAS"
    | "CERTIFICADO_TECNICO"
    | "LICENCIA_CONDUCCION";

  // Documentos adjuntos: Cédula, Certificaciones SST y Licencia
  const [documentosAdjuntos, setDocumentosAdjuntos] = useState<EmpleadoDocumentoAdjunto[]>(
    empleado.documentos_adjuntos || []
  );

  // Estados de carga atómica (en memoria local, se envían al dar clic en Guardar Cambios)
  const [pendingFiles, setPendingFiles] = useState<{ [key in TipoDocAdjunto]?: File | null }>({});
  const [pendingPreviews, setPendingPreviews] = useState<{ [key in TipoDocAdjunto]?: string | null }>({});
  const [pendingDeletions, setPendingDeletions] = useState<Set<TipoDocAdjunto>>(new Set());

  const fileInputFrontalRef = useRef<HTMLInputElement>(null);
  const fileInputPosteriorRef = useRef<HTMLInputElement>(null);
  const fileInputAlturasRef = useRef<HTMLInputElement>(null);
  const fileInputTecnicoRef = useRef<HTMLInputElement>(null);
  const fileInputLicenciaRef = useRef<HTMLInputElement>(null);

  const cedulaFrontal = documentosAdjuntos.find((d) => d.tipo_documento === "CEDULA_FRONTAL");
  const cedulaPosterior = documentosAdjuntos.find((d) => d.tipo_documento === "CEDULA_POSTERIOR");

  const [certificadoAlturasUrl, setCertificadoAlturasUrl] = useState(
    (empleado.certificaciones_sst || empleado.sst)?.certificado_alturas_url ||
    documentosAdjuntos.find((d) => d.tipo_documento === "CERTIFICADO_ALTURAS")?.archivo_url || ""
  );
  const [certificadoTecnicoUrl, setCertificadoTecnicoUrl] = useState(
    (empleado.certificaciones_sst || empleado.sst)?.certificado_tecnico_url ||
    documentosAdjuntos.find((d) => d.tipo_documento === "CERTIFICADO_TECNICO" || d.tipo_documento === "CERTIFICADO_MEDICO")?.archivo_url || ""
  );

  const licenciaDoc = documentosAdjuntos.find(
    (d) => d.tipo_documento === "LICENCIA_CONDUCCION" || d.tipo_documento === "LICENCIA"
  );
  const [licenciaUrl, setLicenciaUrl] = useState<string | null>(
    licenciaDoc?.archivo_url || null
  );

  const getMediaUrl = (path?: string | null) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:")) return path;
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return `${base.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const getDocumentoFilename = (
    doc?: EmpleadoDocumentoAdjunto | null,
    pendingFile?: File | null
  ) => {
    if (pendingFile) return pendingFile.name;
    if (doc?.archivo_url) {
      const clean = doc.archivo_url.split("?")[0].split("/").pop();
      return clean || "Expediente digital adjunto";
    }
    return null;
  };

  // Handlers para manejo atómico en memoria
  const handleSelectPendingFile = (tipo: TipoDocAdjunto, file: File) => {
    if (pendingPreviews[tipo]?.startsWith("blob:")) {
      URL.revokeObjectURL(pendingPreviews[tipo]!);
    }
    const blobUrl = URL.createObjectURL(file);
    setPendingFiles((prev) => ({ ...prev, [tipo]: file }));
    setPendingPreviews((prev) => ({ ...prev, [tipo]: blobUrl }));
    setPendingDeletions((prev) => {
      const next = new Set(prev);
      next.delete(tipo);
      return next;
    });
  };

  const handleClearPendingFile = (tipo: TipoDocAdjunto) => {
    if (pendingPreviews[tipo]?.startsWith("blob:")) {
      URL.revokeObjectURL(pendingPreviews[tipo]!);
    }
    setPendingFiles((prev) => {
      const next = { ...prev };
      delete next[tipo];
      return next;
    });
    setPendingPreviews((prev) => {
      const next = { ...prev };
      delete next[tipo];
      return next;
    });
  };

  const handleMarkForDeletion = (tipo: TipoDocAdjunto) => {
    handleClearPendingFile(tipo);
    setPendingDeletions((prev) => {
      const next = new Set(prev);
      next.add(tipo);
      return next;
    });
  };

  const handleUndoDeletion = (tipo: TipoDocAdjunto) => {
    setPendingDeletions((prev) => {
      const next = new Set(prev);
      next.delete(tipo);
      return next;
    });
  };

  // Limpieza de URLs blob al desmontar o cerrar el componente
  useEffect(() => {
    return () => {
      Object.values(pendingPreviews).forEach((url) => {
        if (url && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [pendingPreviews]);

  // Form State: Contacto (Tabla 3: empleados_contacto)
  const [correoCorporativo, setCorreoCorporativo] = useState(
    empleado.contacto?.correo_corporativo || empleado.contacto?.email_corporativo || ""
  );
  const [correoPersonal, setCorreoPersonal] = useState(
    empleado.contacto?.correo_personal || empleado.contacto?.email_personal || ""
  );
  const [celularCorporativo, setCelularCorporativo] = useState(
    empleado.contacto?.celular_corporativo || empleado.contacto?.telefono_corporativo || ""
  );
  const [celularPersonal, setCelularPersonal] = useState(
    empleado.contacto?.celular_personal || empleado.contacto?.telefono_personal || ""
  );
  const [celularAlterno, setCelularAlterno] = useState(
    empleado.contacto?.celular_alterno || ""
  );
  const [telefonoFijo, setTelefonoFijo] = useState(
    empleado.contacto?.telefono_fijo || ""
  );
  const [direccionResidencia, setDireccionResidencia] = useState(
    empleado.contacto?.direccion_residencia || ""
  );
  const [claroPay, setClaroPay] = useState(
    empleado.contacto?.claro_pay || ""
  );

  // Form State: Seguridad Social & SST
  const [eps, setEps] = useState(empleado.seguridad_social?.eps || "SURA");
  const [arl, setArl] = useState(empleado.seguridad_social?.arl || "COLMENA");
  const [afp, setAfp] = useState(empleado.seguridad_social?.afp || empleado.seguridad_social?.afp_pensiones || "PORVENIR");
  const [permisoTrabajo, setPermisoTrabajo] = useState(
    (empleado.certificaciones_sst || empleado.sst)?.permiso_trabajo || ""
  );
  const [vencimientoAlturas, setVencimientoAlturas] = useState(
    (empleado.certificaciones_sst || empleado.sst)?.vencimiento_alturas ||
    (empleado.certificaciones_sst || empleado.sst)?.curso_alturas_fecha_vence || ""
  );
  const [vencimientoTecnico, setVencimientoTecnico] = useState(
    (empleado.certificaciones_sst || empleado.sst)?.vencimiento_tecnico ||
    (empleado.certificaciones_sst || empleado.sst)?.examen_medico_fecha_vence || ""
  );

  // Form State: Dotación & Activos
  const [tallaCamisa, setTallaCamisa] = useState(
    (empleado.dotacion_activos || empleado.dotacion)?.talla_camisa || "M"
  );
  const [tallaPantalon, setTallaPantalon] = useState(
    (empleado.dotacion_activos || empleado.dotacion)?.talla_pantalon || "32"
  );
  const [tallaCalzado, setTallaCalzado] = useState(
    (empleado.dotacion_activos || empleado.dotacion)?.talla_calzado || "40"
  );
  const [tallaChaqueta, setTallaChaqueta] = useState(
    (empleado.dotacion_activos || empleado.dotacion)?.talla_chaqueta || "M"
  );
  const [tallaGuerrera, setTallaGuerrera] = useState(
    (empleado.dotacion_activos || empleado.dotacion)?.talla_guerrera || ""
  );
  const [tieneCarnet, setTieneCarnet] = useState(
    (empleado.dotacion_activos || empleado.dotacion)?.tiene_carnet || false
  );
  const [fechaEntregaCarnet, setFechaEntregaCarnet] = useState(
    (empleado.dotacion_activos || empleado.dotacion)?.fecha_entrega_carnet || ""
  );

  const handleCarnetToggle = (checked: boolean) => {
    setTieneCarnet(checked);
    if (checked && !fechaEntregaCarnet) {
      setFechaEntregaCarnet(new Date().toISOString().split("T")[0]);
    }
  };

  // Form State: Movilidad & Vehículo (Tabla 7: empleados_movilidad)
  const [sabeConducir, setSabeConducir] = useState<boolean>(
    empleado.movilidad?.sabe_conducir ?? false
  );
  const [medioTransporte, setMedioTransporte] = useState<string>(
    empleado.movilidad?.medio_transporte || ""
  );
  const [modeloVehiculo, setModeloVehiculo] = useState<string>(
    empleado.movilidad?.modelo_vehiculo || ""
  );
  const [placaVehiculo, setPlacaVehiculo] = useState<string>(
    empleado.movilidad?.placa_vehiculo || empleado.placa_vehiculo || ""
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (!cargo.trim() || !area.trim() || !carpeta.trim()) {
        toast.error("Cargo, Área y Carpeta son campos obligatorios.");
        setActiveTab("laboral");
        setIsSubmitting(false);
        return;
      }

      if (!fechaIngreso) {
        toast.error("La fecha de ingreso es requerida para el perfil laboral.");
        setActiveTab("laboral");
        setIsSubmitting(false);
        return;
      }

      // Validación de Cédula: si se incluye o conserva una cara, ambas caras son obligatorias
      const hasFrontalCheck =
        (Boolean(cedulaFrontal) && !pendingDeletions.has("CEDULA_FRONTAL")) ||
        Boolean(pendingFiles["CEDULA_FRONTAL"]);

      const hasPosteriorCheck =
        (Boolean(cedulaPosterior) && !pendingDeletions.has("CEDULA_POSTERIOR")) ||
        Boolean(pendingFiles["CEDULA_POSTERIOR"]);

      if ((hasFrontalCheck && !hasPosteriorCheck) || (!hasFrontalCheck && hasPosteriorCheck)) {
        toast.error(
          `Para el documento de identidad se requieren ambas caras. Falta adjuntar la cara ${
            !hasFrontalCheck ? "Frontal" : "Posterior (Reverso)"
          }.`
        );
        setActiveTab("contacto");
        setIsSubmitting(false);
        return;
      }

      // 1. Procesar eliminaciones pendientes en el backend
      for (const tipo of pendingDeletions) {
        try {
          await personalService.eliminarDocumento(empleado.id, tipo);
        } catch (delErr: any) {
          console.error(`Error al eliminar documento ${tipo}:`, delErr);
        }
      }

      // 2. Procesar subidas de documentos pendientes
      const uploadedDocs: Record<string, string> = {};
      const tiposToUpload = (Object.keys(pendingFiles) as TipoDocAdjunto[]).filter(
        (t) => pendingFiles[t] instanceof File
      );

      for (const tipo of tiposToUpload) {
        const file = pendingFiles[tipo]!;
        const doc = await personalService.subirDocumento(empleado.id, tipo, file);
        uploadedDocs[tipo] = doc.archivo_url;
      }

      // 3. Determinar URLs finales de certificaciones SST
      let finalAlturasUrl = certificadoAlturasUrl;
      if (pendingDeletions.has("CERTIFICADO_ALTURAS")) {
        finalAlturasUrl = "";
      } else if (uploadedDocs["CERTIFICADO_ALTURAS"]) {
        finalAlturasUrl = uploadedDocs["CERTIFICADO_ALTURAS"];
      }

      let finalTecnicoUrl = certificadoTecnicoUrl;
      if (pendingDeletions.has("CERTIFICADO_TECNICO")) {
        finalTecnicoUrl = "";
      } else if (uploadedDocs["CERTIFICADO_TECNICO"]) {
        finalTecnicoUrl = uploadedDocs["CERTIFICADO_TECNICO"];
      }

      const payload = {
        nombres: nombres.trim().toUpperCase() || undefined,
        apellidos: apellidos.trim().toUpperCase() || undefined,
        tipo_documento: tipoDoc,
        numero_documento: numeroDoc.trim(),
        fecha_expedicion_documento: fechaExpedicionDoc || null,
        pasaporte: pasaporte.trim() || null,
        fecha_nacimiento: fechaNacimiento || null,
        genero: genero || null,
        estado_civil: estadoCivil || null,
        laboral: {
          cargo: cargo.trim().toUpperCase(),
          tipo_labor: tipoLabor,
          sede: sede.trim().toUpperCase() || "MEDELLIN",
          area: area.trim().toUpperCase(),
          carpeta: carpeta.trim().toUpperCase(),
          codigo_sap: codigoSap.trim() || null,
          puesto: puesto.trim() || null,
          movil: movil.trim() || null,
          funcion_cargo: funcionCargo.trim() || null,
          zona_nodo: zonaNodo.trim() || null,
          supervisor: supervisorId ? Number(supervisorId) : null,
          padrino: padrinoId ? Number(padrinoId) : null,
          formador: formador.trim() || null,
          grupo_comisiones: grupoComisiones.trim() || null,
          nivel_estudio: nivelEstudio.trim() || null,
          fecha_ingreso: fechaIngreso,
          etapa_induccion: etapaInduccion,
          practica_lectiva_inicio: practicaLectivaInicio || null,
          practica_lectiva_fin: practicaLectivaFin || null,
          practica_productiva_inicio: practicaProductivaInicio || null,
          practica_productiva_fin: practicaProductivaFin || null,
        },
        contacto: {
          correo_corporativo: correoCorporativo.trim() || null,
          correo_personal: correoPersonal.trim() || null,
          celular_corporativo: celularCorporativo.trim() || null,
          celular_personal: celularPersonal.trim() || null,
          celular_alterno: celularAlterno.trim() || null,
          telefono_fijo: telefonoFijo.trim() || null,
          direccion_residencia: direccionResidencia.trim() || null,
          claro_pay: claroPay.trim() || null,
        },
        seguridad_social: {
          eps: eps.trim() || null,
          arl: arl.trim() || null,
          afp: afp.trim() || null,
        },
        certificaciones_sst: {
          permiso_trabajo: permisoTrabajo.trim() || null,
          vencimiento_alturas: vencimientoAlturas || null,
          certificado_alturas_url: finalAlturasUrl || null,
          vencimiento_tecnico: vencimientoTecnico || null,
          certificado_tecnico_url: finalTecnicoUrl || null,
        },
        dotacion_activos: {
          talla_camisa: tallaCamisa || null,
          talla_pantalon: tallaPantalon || null,
          talla_calzado: tallaCalzado || null,
          talla_chaqueta: tallaChaqueta || null,
          talla_guerrera: tallaGuerrera || null,
          tiene_carnet: tieneCarnet,
          fecha_entrega_carnet: tieneCarnet && fechaEntregaCarnet ? fechaEntregaCarnet : null,
        },
        movilidad: {
          sabe_conducir: sabeConducir,
          medio_transporte: medioTransporte || null,
          modelo_vehiculo: modeloVehiculo.trim() || null,
          placa_vehiculo: placaVehiculo.trim().toUpperCase() || null,
        },
      };

      const updated = await personalService.patchEmpleado(empleado.id, payload as any);
      toast.success("Información y documentos del colaborador actualizados exitosamente.");
      updateLocalItem(updated);
      await fetchEmpleadoDetail(empleado.id);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg =
        err?.detail ||
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Error al actualizar la información";
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
      <div className="relative my-auto w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Editar Datos del Colaborador
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {empleado.nombre_completo} • {empleado.tipo_documento} {empleado.numero_documento}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section Tabs inside Edit Modal */}
        <div className="flex border-b border-gray-100 pt-3 dark:border-gray-800 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("contacto")}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "contacto"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Datos Básicos & Contacto</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("laboral")}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "laboral"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>Información Laboral</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sst")}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "sst"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Seguridad Social & SST</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("dotacion")}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "dotacion"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
            }`}
          >
            <Shirt className="h-3.5 w-3.5" />
            <span>Dotación & Tallas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("movilidad")}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "movilidad"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
            }`}
          >
            <Car className="h-3.5 w-3.5" />
            <span>Movilidad & Transporte</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* TAB: INFORMACIÓN LABORAL */}
          {activeTab === "laboral" && (
            <div className="space-y-4">
              {/* Bloque 1: Cargo, Tipo de Labor y Funciones */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Cargo y Tipo de Labor
                    </h4>
                  </div>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 border border-brand-200/50 dark:border-brand-700/50">
                    {tipoLabor}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Cargo Asignado <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value.toUpperCase())}
                      placeholder="Ej: TÉCNICO, AUXILIAR, SUPERVISOR..."
                      required
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                      <span>Tipo de Labor <span className="text-red-500">*</span></span>
                      <span className="text-3xs text-gray-400 font-normal">Jerarquía operativa</span>
                    </label>
                    <select
                      value={tipoLabor}
                      onChange={(e) => setTipoLabor(e.target.value)}
                      required
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs font-medium text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="OPERATIVO">OPERATIVO (Técnicos y Cuadrillas en campo)</option>
                      <option value="ADMINISTRATIVO">ADMINISTRATIVO (Personal de gestión y oficina)</option>
                      <option value="SUPERVISOR">SUPERVISOR (Líder operativo y supervisión)</option>
                      <option value="TRANSVERSAL">TRANSVERSAL (Áreas de apoyo transversal)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Funciones Principales del Cargo
                  </label>
                  <textarea
                    rows={2}
                    value={funcionCargo}
                    onChange={(e) => setFuncionCargo(e.target.value)}
                    placeholder="Descripción resumida de responsabilidades y actividades del cargo..."
                    className="w-full rounded-lg border border-gray-300 bg-white p-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Bloque 2: Estructura Organizativa y Ubicación */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <Building2 className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Estructura Organizativa y Asignación Operativa
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Sede <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={sede}
                      onChange={(e) => setSede(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      {SEDES_COLOMBIA.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Área <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={area}
                      onChange={(e) => setArea(e.target.value.toUpperCase())}
                      placeholder="Ej: OPERACIONES"
                      required
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Carpeta <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={carpeta}
                      onChange={(e) => setCarpeta(e.target.value.toUpperCase())}
                      placeholder="Ej: RESIDENCIAL"
                      required
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Código SAP
                    </label>
                    <input
                      type="text"
                      value={codigoSap}
                      onChange={(e) => setCodigoSap(e.target.value.trim())}
                      placeholder="Ej: SAP-12345"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-mono text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Móvil / Cuadrilla
                    </label>
                    <input
                      type="text"
                      value={movil}
                      onChange={(e) => setMovil(e.target.value.toUpperCase())}
                      placeholder="Ej: M-101 / SIN ASIGNAR"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-mono uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Zona o Nodo
                    </label>
                    <input
                      type="text"
                      value={zonaNodo}
                      onChange={(e) => setZonaNodo(e.target.value.toUpperCase())}
                      placeholder="Ej: NODO NORTE"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Puesto Físico
                    </label>
                    <input
                      type="text"
                      value={puesto}
                      onChange={(e) => setPuesto(e.target.value)}
                      placeholder="Ej: Estación 4"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Bloque 3: Jerarquía, Mentores y Formación */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <User className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Liderazgo, Formación y Compensación
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Supervisor / Líder Directo
                    </label>
                    <select
                      value={supervisorId}
                      onChange={(e) => setSupervisorId(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Sin supervisor asignado...</option>
                      {supervisores.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.nombre || (sup as any).nombre_completo} {sup.cargo ? `(${sup.cargo})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Padrino / Mentor de Inducción
                    </label>
                    <select
                      value={padrinoId}
                      onChange={(e) => setPadrinoId(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Sin padrino asignado...</option>
                      {supervisores.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.nombre || (sup as any).nombre_completo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Formador Asignado
                    </label>
                    <input
                      type="text"
                      value={formador}
                      onChange={(e) => setFormador(e.target.value)}
                      placeholder="Nombre del formador GH"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Grupo de Comisiones
                    </label>
                    <input
                      type="text"
                      value={grupoComisiones}
                      onChange={(e) => setGrupoComisiones(e.target.value.toUpperCase())}
                      placeholder="Ej: COMISION_FTTH_2026"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Nivel de Estudio
                    </label>
                    <select
                      value={nivelEstudio}
                      onChange={(e) => setNivelEstudio(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Seleccione nivel...</option>
                      {NIVELES_ESTUDIO.map((lvl) => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Bloque 4: Fechas Contractuales e Inducción */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <Calendar className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Fechas Contractuales y Etapa de Inducción
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Fecha de Ingreso Contractual <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      id="fecha_ingreso_laboral_input"
                      placeholder="AAAA-MM-DD"
                      defaultDate={fechaIngreso ? toDateOrUndefined(fechaIngreso) : undefined}
                      onChange={(dates: Date[] | Date) => {
                        const selected = Array.isArray(dates) ? dates[0] : dates;
                        if (selected instanceof Date && !isNaN(selected.getTime())) {
                          const y = selected.getFullYear();
                          const m = String(selected.getMonth() + 1).padStart(2, "0");
                          const d = String(selected.getDate()).padStart(2, "0");
                          setFechaIngreso(`${y}-${m}-${d}`);
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Etapa de Inducción
                    </label>
                    <select
                      value={etapaInduccion}
                      onChange={(e) => setEtapaInduccion(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="EN_FORMACION">1. En Formación (Gestión Humana)</option>
                      <option value="ENTREGADO">2. Entregado al Área Operativa</option>
                    </select>
                  </div>
                </div>

                {/* Subsección SENA / Formación Dual */}
                <div className="pt-2 border-t border-gray-200/50 dark:border-gray-700/50 space-y-2">
                  <p className="text-2xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Etapas de Aprendizaje SENA (Opcional para Practicantes)
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-3xs font-semibold text-gray-600 dark:text-gray-400 mb-0.5">
                          Lectiva Inicio
                        </label>
                        <DatePicker
                          id="practica_lectiva_inicio_input"
                          placeholder="AAAA-MM-DD"
                          defaultDate={practicaLectivaInicio ? toDateOrUndefined(practicaLectivaInicio) : undefined}
                          onChange={(dates: Date[] | Date) => {
                        const selected = Array.isArray(dates) ? dates[0] : dates;
                        if (selected instanceof Date && !isNaN(selected.getTime())) {
                          const y = selected.getFullYear();
                          const m = String(selected.getMonth() + 1).padStart(2, "0");
                          const d = String(selected.getDate()).padStart(2, "0");
                          setPracticaLectivaInicio(`${y}-${m}-${d}`);
                        }
                      }}
                        />
                      </div>
                      <div>
                        <label className="block text-3xs font-semibold text-gray-600 dark:text-gray-400 mb-0.5">
                          Lectiva Fin
                        </label>
                        <DatePicker
                          id="practica_lectiva_fin_input"
                          placeholder="AAAA-MM-DD"
                          defaultDate={practicaLectivaFin ? toDateOrUndefined(practicaLectivaFin) : undefined}
                          onChange={(dates: Date[] | Date) => {
                        const selected = Array.isArray(dates) ? dates[0] : dates;
                        if (selected instanceof Date && !isNaN(selected.getTime())) {
                          const y = selected.getFullYear();
                          const m = String(selected.getMonth() + 1).padStart(2, "0");
                          const d = String(selected.getDate()).padStart(2, "0");
                          setPracticaLectivaFin(`${y}-${m}-${d}`);
                        }
                      }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-3xs font-semibold text-gray-600 dark:text-gray-400 mb-0.5">
                          Productiva Inicio
                        </label>
                        <DatePicker
                          id="practica_productiva_inicio_input"
                          placeholder="AAAA-MM-DD"
                          defaultDate={practicaProductivaInicio ? toDateOrUndefined(practicaProductivaInicio) : undefined}
                          onChange={(dates: Date[] | Date) => {
                        const selected = Array.isArray(dates) ? dates[0] : dates;
                        if (selected instanceof Date && !isNaN(selected.getTime())) {
                          const y = selected.getFullYear();
                          const m = String(selected.getMonth() + 1).padStart(2, "0");
                          const d = String(selected.getDate()).padStart(2, "0");
                          setPracticaProductivaInicio(`${y}-${m}-${d}`);
                        }
                      }}
                        />
                      </div>
                      <div>
                        <label className="block text-3xs font-semibold text-gray-600 dark:text-gray-400 mb-0.5">
                          Productiva Fin
                        </label>
                        <DatePicker
                          id="practica_productiva_fin_input"
                          placeholder="AAAA-MM-DD"
                          defaultDate={practicaProductivaFin ? toDateOrUndefined(practicaProductivaFin) : undefined}
                          onChange={(dates: Date[] | Date) => {
                        const selected = Array.isArray(dates) ? dates[0] : dates;
                        if (selected instanceof Date && !isNaN(selected.getTime())) {
                          const y = selected.getFullYear();
                          const m = String(selected.getMonth() + 1).padStart(2, "0");
                          const d = String(selected.getDate()).padStart(2, "0");
                          setPracticaProductivaFin(`${y}-${m}-${d}`);
                        }
                      }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DATOS BÁSICOS & CONTACTO */}
          {activeTab === "contacto" && (
            <div className="space-y-4">
              {/* Bloque: Identidad y Documento Oficial (Tabla 1: empleados_perfil) */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Identidad y Documento Oficial
                  </h4>
                </div>

                {/* Nombres y Apellidos */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Nombres del Colaborador <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={nombres}
                      onChange={(e) => setNombres(e.target.value.toUpperCase())}
                      placeholder="Nombres completos"
                      required
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Apellidos del Colaborador <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={apellidos}
                      onChange={(e) => setApellidos(e.target.value.toUpperCase())}
                      placeholder="Apellidos completos"
                      required
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Tipo Doc, Numero, Fecha Expedicion, Pasaporte/Siigo */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Tipo Documento <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={tipoDoc}
                      onChange={(e) => setTipoDoc(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="CC">Cédula de Ciudadanía (CC)</option>
                      <option value="CE">Cédula de Extranjería (CE)</option>
                      <option value="PASAPORTE">Pasaporte</option>
                      <option value="PPT">PPT</option>
                      <option value="PEP">PEP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Número Documento <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={numeroDoc}
                      onChange={(e) => setNumeroDoc(e.target.value.trim())}
                      placeholder="Sin puntos ni comas"
                      required
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-mono text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Fecha de Expedición
                    </label>
                    <DatePicker
                      id="fecha_expedicion_doc_input"
                      placeholder="AAAA-MM-DD"
                      defaultDate={fechaExpedicionDoc ? toDateOrUndefined(fechaExpedicionDoc) : undefined}
                      onChange={(dates: Date[] | Date) => {
                        const selected = Array.isArray(dates) ? dates[0] : dates;
                        if (selected instanceof Date && !isNaN(selected.getTime())) {
                          const y = selected.getFullYear();
                          const m = String(selected.getMonth() + 1).padStart(2, "0");
                          const d = String(selected.getDate()).padStart(2, "0");
                          setFechaExpedicionDoc(`${y}-${m}-${d}`);
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Cédula Siigo / Alterno
                    </label>
                    <input
                      type="text"
                      value={pasaporte}
                      onChange={(e) => setPasaporte(e.target.value.trim())}
                      placeholder="Ej: Código Siigo"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Fecha Nacimiento, Genero, Estado Civil */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Fecha de Nacimiento
                    </label>
                    <DatePicker
                      id="fecha_nacimiento_perfil"
                      placeholder="AAAA-MM-DD"
                      defaultDate={fechaNacimiento ? toDateOrUndefined(fechaNacimiento) : undefined}
                      onChange={(dates: Date[] | Date) => {
                        const selected = Array.isArray(dates) ? dates[0] : dates;
                        if (selected instanceof Date && !isNaN(selected.getTime())) {
                          const y = selected.getFullYear();
                          const m = String(selected.getMonth() + 1).padStart(2, "0");
                          const d = String(selected.getDate()).padStart(2, "0");
                          setFechaNacimiento(`${y}-${m}-${d}`);
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Género
                    </label>
                    <select
                      value={genero}
                      onChange={(e) => setGenero(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Seleccione género...</option>
                      <option value="MASCULINO">MASCULINO</option>
                      <option value="FEMENINO">FEMENINO</option>
                      <option value="OTRO">OTRO</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Estado Civil
                    </label>
                    <select
                      value={estadoCivil}
                      onChange={(e) => setEstadoCivil(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Seleccione estado civil...</option>
                      <option value="SOLTERO">SOLTERO(A)</option>
                      <option value="CASADO">CASADO(A)</option>
                      <option value="UNION_LIBRE">UNIÓN LIBRE</option>
                      <option value="DIVORCIADO">DIVORCIADO(A)</option>
                      <option value="VIUDO">VIUDO(A)</option>
                    </select>
                  </div>
                </div>

                {/* Subida de Cédula por Lado y Lado (Tabla 11: empleados_documentos_adjuntos) */}
                <div className="pt-3 border-t border-gray-200/60 dark:border-gray-700/60 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    <h5 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Copia de Documento de Identidad (Cédula Digital)
                    </h5>
                  </div>

                  {/* Hidden file inputs */}
                  <input
                    ref={fileInputFrontalRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSelectPendingFile("CEDULA_FRONTAL", file);
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={fileInputPosteriorRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSelectPendingFile("CEDULA_POSTERIOR", file);
                      e.target.value = "";
                    }}
                  />

                  {(() => {
                    const frontalFilename = getDocumentoFilename(cedulaFrontal, pendingFiles["CEDULA_FRONTAL"]);
                    const isFrontalDeleted = pendingDeletions.has("CEDULA_FRONTAL");
                    const isFrontalActive = Boolean(cedulaFrontal || pendingFiles["CEDULA_FRONTAL"]) && !isFrontalDeleted;

                    const posteriorFilename = getDocumentoFilename(cedulaPosterior, pendingFiles["CEDULA_POSTERIOR"]);
                    const isPosteriorDeleted = pendingDeletions.has("CEDULA_POSTERIOR");
                    const isPosteriorActive = Boolean(cedulaPosterior || pendingFiles["CEDULA_POSTERIOR"]) && !isPosteriorDeleted;

                    return (
                      <div className="space-y-2">
                        {/* Cédula Cara Frontal */}
                        <div
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                            isFrontalDeleted
                              ? "border-red-300 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20"
                              : "border-gray-200 bg-white dark:border-gray-700/80 dark:bg-gray-800/70"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                isFrontalActive
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                  : isFrontalDeleted
                                  ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                                  : "bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-400"
                              }`}
                            >
                              <FileText className="h-4 w-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                  Cara Frontal
                                </span>
                                {isFrontalActive && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                )}
                              </div>

                              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5 truncate max-w-[280px]">
                                {isFrontalDeleted
                                  ? "Se eliminará al guardar cambios"
                                  : frontalFilename || "Ningún archivo seleccionado"}
                              </p>
                            </div>
                          </div>

                          {/* Acciones: [Ver] [Eliminar] [Cambiar/Subir] */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isFrontalDeleted ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleUndoDeletion("CEDULA_FRONTAL")}
                                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-brand-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-brand-400"
                                >
                                  <span>Deshacer</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => fileInputFrontalRef.current?.click()}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-brand-500 dark:bg-brand-500 dark:hover:bg-brand-400"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  <span>Subir</span>
                                </button>
                              </>
                            ) : isFrontalActive ? (
                              <>
                                <a
                                  href={
                                    pendingPreviews["CEDULA_FRONTAL"] ||
                                    (cedulaFrontal ? getMediaUrl(cedulaFrontal.archivo_url) : "#")
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                                  title="Ver archivo"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  <span>Ver</span>
                                </a>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (pendingFiles["CEDULA_FRONTAL"]) {
                                      handleClearPendingFile("CEDULA_FRONTAL");
                                    } else {
                                      handleMarkForDeletion("CEDULA_FRONTAL");
                                    }
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/60 transition-colors"
                                  title="Eliminar archivo"
                                  aria-label="Eliminar archivo"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => fileInputFrontalRef.current?.click()}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-brand-500 dark:bg-brand-500 dark:hover:bg-brand-400"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  <span>Cambiar</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => fileInputFrontalRef.current?.click()}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-brand-500 dark:bg-brand-500 dark:hover:bg-brand-400"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                <span>Subir Frontal</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Cédula Cara Posterior */}
                        <div
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                            isPosteriorDeleted
                              ? "border-red-300 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20"
                              : "border-gray-200 bg-white dark:border-gray-700/80 dark:bg-gray-800/70"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                isPosteriorActive
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                  : isPosteriorDeleted
                                  ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                                  : "bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-400"
                              }`}
                            >
                              <FileText className="h-4 w-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                  Cara Posterior (Reverso)
                                </span>
                                {isPosteriorActive && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                )}
                              </div>

                              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5 truncate max-w-[280px]">
                                {isPosteriorDeleted
                                  ? "Se eliminará al guardar cambios"
                                  : posteriorFilename || "Ningún archivo seleccionado"}
                              </p>
                            </div>
                          </div>

                          {/* Acciones: [Ver] [Eliminar] [Cambiar/Subir] */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isPosteriorDeleted ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleUndoDeletion("CEDULA_POSTERIOR")}
                                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-brand-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-brand-400"
                                >
                                  <span>Deshacer</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => fileInputPosteriorRef.current?.click()}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-brand-500 dark:bg-brand-500 dark:hover:bg-brand-400"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  <span>Subir</span>
                                </button>
                              </>
                            ) : isPosteriorActive ? (
                              <>
                                <a
                                  href={
                                    pendingPreviews["CEDULA_POSTERIOR"] ||
                                    (cedulaPosterior ? getMediaUrl(cedulaPosterior.archivo_url) : "#")
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                                  title="Ver archivo"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  <span>Ver</span>
                                </a>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (pendingFiles["CEDULA_POSTERIOR"]) {
                                      handleClearPendingFile("CEDULA_POSTERIOR");
                                    } else {
                                      handleMarkForDeletion("CEDULA_POSTERIOR");
                                    }
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/60 transition-colors"
                                  title="Eliminar archivo"
                                  aria-label="Eliminar archivo"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => fileInputPosteriorRef.current?.click()}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-brand-500 dark:bg-brand-500 dark:hover:bg-brand-400"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  <span>Cambiar</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => fileInputPosteriorRef.current?.click()}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-brand-500 dark:bg-brand-500 dark:hover:bg-brand-400"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                <span>Subir Reverso</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Bloque: Contacto y Residencia (Tabla 3: empleados_contacto) */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <Phone className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Comunicaciones y Residencia
                  </h4>
                </div>

                {/* Subsección: Líneas Telefónicas y Móviles */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Celular Personal
                    </label>
                    <input
                      type="text"
                      value={celularPersonal}
                      onChange={(e) => setCelularPersonal(e.target.value)}
                      placeholder="Ej: 3151234567"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Celular Corporativo
                    </label>
                    <input
                      type="text"
                      value={celularCorporativo}
                      onChange={(e) => setCelularCorporativo(e.target.value)}
                      placeholder="Ej: 3209876543"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Celular Alterno
                    </label>
                    <input
                      type="text"
                      value={celularAlterno}
                      onChange={(e) => setCelularAlterno(e.target.value)}
                      placeholder="Ej: 3109876543"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Teléfono Fijo
                    </label>
                    <input
                      type="text"
                      value={telefonoFijo}
                      onChange={(e) => setTelefonoFijo(e.target.value)}
                      placeholder="Ej: 4445566"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Subsección: Correos Electrónicos y Claro Pay */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Correo Personal
                    </label>
                    <input
                      type="email"
                      value={correoPersonal}
                      onChange={(e) => setCorreoPersonal(e.target.value)}
                      placeholder="ejemplo@gmail.com"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Correo Corporativo
                    </label>
                    <input
                      type="email"
                      value={correoCorporativo}
                      onChange={(e) => setCorreoCorporativo(e.target.value)}
                      placeholder="usuario@cincosas.com"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Claro Pay
                    </label>
                    <input
                      type="text"
                      value={claroPay}
                      onChange={(e) => setClaroPay(e.target.value)}
                      placeholder="Ej: 3001234567 / ID Claro Pay"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Subsección: Dirección de Residencia */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Dirección de Residencia
                  </label>
                  <input
                    type="text"
                    value={direccionResidencia}
                    onChange={(e) => setDireccionResidencia(e.target.value)}
                    placeholder="Ej: Calle 25 # 14-30 Barrio Las Palmas"
                    className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: SEGURIDAD SOCIAL & SST */}
          {activeTab === "sst" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Entidad EPS
                  </label>
                  <select
                    value={eps}
                    onChange={(e) => setEps(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    {EPS_COLOMBIA.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Fondo de Pensiones (AFP)
                  </label>
                  <select
                    value={afp}
                    onChange={(e) => setAfp(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    {AFP_COLOMBIA.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    ARL Riesgos Laborales
                  </label>
                  <select
                    value={arl}
                    onChange={(e) => setArl(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    {ARL_COLOMBIA.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Permiso de Trabajo */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Permiso de Trabajo / Autorización SST
                </label>
                <input
                  type="text"
                  value={permisoTrabajo}
                  onChange={(e) => setPermisoTrabajo(e.target.value)}
                  placeholder="Ej: AUTORIZADO - ALTURAS Y CONFINADOS"
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* Hidden file inputs for SST documents */}
              <input
                ref={fileInputAlturasRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSelectPendingFile("CERTIFICADO_ALTURAS", file);
                  e.target.value = "";
                }}
              />
              <input
                ref={fileInputTecnicoRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleSelectPendingFile("CERTIFICADO_TECNICO", file);
                  e.target.value = "";
                }}
              />

              {/* Cards for Alturas and Examen Médico with DatePicker + Upload Support */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                {/* Curso de Alturas */}
                <div className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 shadow-xs transition-colors ${
                  pendingDeletions.has("CERTIFICADO_ALTURAS")
                    ? "border-red-300 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20"
                    : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                }`}>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>Curso de Alturas</span>
                          {(certificadoAlturasUrl || pendingFiles["CERTIFICADO_ALTURAS"]) && !pendingDeletions.has("CERTIFICADO_ALTURAS") && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                        </p>
                        {pendingFiles["CERTIFICADO_ALTURAS"] ? (
                          <p className="text-2xs text-gray-600 dark:text-gray-300 font-mono mt-0.5 truncate max-w-[150px]" title={pendingFiles["CERTIFICADO_ALTURAS"]?.name}>
                            {pendingFiles["CERTIFICADO_ALTURAS"]?.name}
                          </p>
                        ) : pendingDeletions.has("CERTIFICADO_ALTURAS") ? (
                          <p className="text-2xs text-red-600 dark:text-red-400 mt-0.5">Se eliminará al guardar</p>
                        ) : (
                          <p className="text-2xs text-gray-500 mt-0.5">
                            {certificadoAlturasUrl ? "Certificado cargado en expediente" : "Sin certificado cargado"}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {pendingFiles["CERTIFICADO_ALTURAS"] && pendingPreviews["CERTIFICADO_ALTURAS"] ? (
                          <>
                            <a
                              href={pendingPreviews["CERTIFICADO_ALTURAS"]!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-2xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Ver</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => handleClearPendingFile("CERTIFICADO_ALTURAS")}
                              className="inline-flex items-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                              title="Descartar selección"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : pendingDeletions.has("CERTIFICADO_ALTURAS") ? (
                          <button
                            type="button"
                            onClick={() => handleUndoDeletion("CERTIFICADO_ALTURAS")}
                            className="text-2xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                          >
                            Deshacer
                          </button>
                        ) : certificadoAlturasUrl ? (
                          <>
                            <a
                              href={getMediaUrl(certificadoAlturasUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 text-2xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-650 dark:bg-gray-700 dark:text-gray-200 whitespace-nowrap"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Ver</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => handleMarkForDeletion("CERTIFICADO_ALTURAS")}
                              className="inline-flex items-center rounded-md p-1 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                              title="Eliminar al guardar"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-2xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        Fecha de Vencimiento Curso Alturas
                      </label>
                      <DatePicker
                        id="vencimiento_alturas"
                        placeholder="AAAA-MM-DD"
                        defaultDate={vencimientoAlturas ? toDateOrUndefined(vencimientoAlturas) : undefined}
                        onChange={(dates: Date[] | Date) => {
                          const selected = Array.isArray(dates) ? dates[0] : dates;
                          if (selected instanceof Date && !isNaN(selected.getTime())) {
                            const y = selected.getFullYear();
                            const m = String(selected.getMonth() + 1).padStart(2, "0");
                            const d = String(selected.getDate()).padStart(2, "0");
                            setVencimientoAlturas(`${y}-${m}-${d}`);
                          }
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputAlturasRef.current?.click()}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750"
                  >
                    <Upload className="h-3.5 w-3.5 text-brand-500" />
                    <span>
                      {pendingFiles["CERTIFICADO_ALTURAS"]
                        ? "Cambiar archivo seleccionado"
                        : certificadoAlturasUrl && !pendingDeletions.has("CERTIFICADO_ALTURAS")
                        ? "Reemplazar Certificado Alturas"
                        : "Subir PDF Certificado Alturas"}
                    </span>
                  </button>
                </div>

                {/* Examen Médico Ocupacional */}
                <div className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 shadow-xs transition-colors ${
                  pendingDeletions.has("CERTIFICADO_TECNICO")
                    ? "border-red-300 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20"
                    : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                }`}>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>Examen Médico Ocupacional</span>
                          {(certificadoTecnicoUrl || pendingFiles["CERTIFICADO_TECNICO"]) && !pendingDeletions.has("CERTIFICADO_TECNICO") && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                        </p>
                        {pendingFiles["CERTIFICADO_TECNICO"] ? (
                          <p className="text-2xs text-gray-600 dark:text-gray-300 font-mono mt-0.5 truncate max-w-[150px]" title={pendingFiles["CERTIFICADO_TECNICO"]?.name}>
                            {pendingFiles["CERTIFICADO_TECNICO"]?.name}
                          </p>
                        ) : pendingDeletions.has("CERTIFICADO_TECNICO") ? (
                          <p className="text-2xs text-red-600 dark:text-red-400 mt-0.5">Se eliminará al guardar</p>
                        ) : (
                          <p className="text-2xs text-gray-500 mt-0.5">
                            {certificadoTecnicoUrl ? "Soporte médico cargado en expediente" : "Sin soporte cargado"}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {pendingFiles["CERTIFICADO_TECNICO"] && pendingPreviews["CERTIFICADO_TECNICO"] ? (
                          <>
                            <a
                              href={pendingPreviews["CERTIFICADO_TECNICO"]!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-2xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Ver</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => handleClearPendingFile("CERTIFICADO_TECNICO")}
                              className="inline-flex items-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                              title="Descartar selección"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : pendingDeletions.has("CERTIFICADO_TECNICO") ? (
                          <button
                            type="button"
                            onClick={() => handleUndoDeletion("CERTIFICADO_TECNICO")}
                            className="text-2xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                          >
                            Deshacer
                          </button>
                        ) : certificadoTecnicoUrl ? (
                          <>
                            <a
                              href={getMediaUrl(certificadoTecnicoUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 text-2xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-650 dark:bg-gray-700 dark:text-gray-200 whitespace-nowrap"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Ver</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => handleMarkForDeletion("CERTIFICADO_TECNICO")}
                              className="inline-flex items-center rounded-md p-1 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                              title="Eliminar al guardar"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-2xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        Fecha de Vencimiento Examen Médico
                      </label>
                      <DatePicker
                        id="vencimiento_tecnico"
                        placeholder="AAAA-MM-DD"
                        defaultDate={vencimientoTecnico ? toDateOrUndefined(vencimientoTecnico) : undefined}
                        onChange={(dates: Date[] | Date) => {
                          const selected = Array.isArray(dates) ? dates[0] : dates;
                          if (selected instanceof Date && !isNaN(selected.getTime())) {
                            const y = selected.getFullYear();
                            const m = String(selected.getMonth() + 1).padStart(2, "0");
                            const d = String(selected.getDate()).padStart(2, "0");
                            setVencimientoTecnico(`${y}-${m}-${d}`);
                          }
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputTecnicoRef.current?.click()}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750"
                  >
                    <Upload className="h-3.5 w-3.5 text-brand-500" />
                    <span>
                      {pendingFiles["CERTIFICADO_TECNICO"]
                        ? "Cambiar archivo seleccionado"
                        : certificadoTecnicoUrl && !pendingDeletions.has("CERTIFICADO_TECNICO")
                        ? "Reemplazar Soporte Médico"
                        : "Subir Soporte Examen Médico"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DOTACION & TALLAS */}
          {activeTab === "dotacion" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Talla Camisa
                  </label>
                  <select
                    value={tallaCamisa}
                    onChange={(e) => setTallaCamisa(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                    <option value="3XL">3XL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Talla Pantalón
                  </label>
                  <select
                    value={tallaPantalon}
                    onChange={(e) => setTallaPantalon(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="28">28</option>
                    <option value="30">30</option>
                    <option value="32">32</option>
                    <option value="34">34</option>
                    <option value="36">36</option>
                    <option value="38">38</option>
                    <option value="40">40</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Botas
                  </label>
                  <select
                    value={tallaCalzado}
                    onChange={(e) => setTallaCalzado(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="36">36</option>
                    <option value="37">37</option>
                    <option value="38">38</option>
                    <option value="39">39</option>
                    <option value="40">40</option>
                    <option value="41">41</option>
                    <option value="42">42</option>
                    <option value="43">43</option>
                    <option value="44">44</option>
                    <option value="45">45</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Talla Chaqueta
                  </label>
                  <select
                    value={tallaChaqueta}
                    onChange={(e) => setTallaChaqueta(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">Sin Asignar</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                    <option value="3XL">3XL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Guerrera
                  </label>
                  <select
                    value={tallaGuerrera}
                    onChange={(e) => setTallaGuerrera(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">Sin Asignar</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                    <option value="3XL">3XL</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
              </div>



              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="tiene_carnet"
                    checked={tieneCarnet}
                    onChange={(e) => handleCarnetToggle(e.target.checked)}
                    className="h-4 w-4 rounded-sm border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 cursor-pointer"
                  />
                  <label htmlFor="tiene_carnet" className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                    Carnet corporativo entregado al colaborador
                  </label>
                </div>

                {tieneCarnet && (
                  <div className="flex items-center gap-2 w-full sm:w-auto animate-fade-in">
                    <span className="text-xs text-gray-500 whitespace-nowrap">Fecha entrega:</span>
                    <div className="w-44">
                      <DatePicker
                        id="fecha_entrega_carnet"
                        placeholder="AAAA-MM-DD"
                        defaultDate={fechaEntregaCarnet ? toDateOrUndefined(fechaEntregaCarnet) : undefined}
                        onChange={(dates: Date[] | Date) => {
                        const selected = Array.isArray(dates) ? dates[0] : dates;
                        if (selected instanceof Date && !isNaN(selected.getTime())) {
                          const y = selected.getFullYear();
                          const m = String(selected.getMonth() + 1).padStart(2, "0");
                          const d = String(selected.getDate()).padStart(2, "0");
                          setFechaEntregaCarnet(`${y}-${m}-${d}`);
                        }
                      }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: MOVILIDAD & FLOTA (Tabla 7: empleados_movilidad) */}
          {activeTab === "movilidad" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Transporte y Vehículo Asignado (Tabla 7: empleados_movilidad)
                    </h4>
                  </div>
                </div>

                {/* Aviso Regla de Exclusividad */}
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
                  <Shield className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    <strong>Regla de Exclusividad:</strong> La placa registrada se valida atómicamente. Si ya pertenecía a otro colaborador, se le retirará y reasignará automáticamente, generando la respectiva traza en la auditoría del sistema.
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Sabe Conducir */}
                  <div className="sm:col-span-2 flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <input
                      type="checkbox"
                      id="sabeConducir"
                      checked={sabeConducir}
                      onChange={(e) => setSabeConducir(e.target.checked)}
                      className="h-4 w-4 rounded-sm border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <label htmlFor="sabeConducir" className="text-xs font-medium text-gray-800 dark:text-gray-200 cursor-pointer">
                      ¿El colaborador posee habilidad y autorización para conducir vehículos? (sabe_conducir)
                    </label>
                  </div>

                  {/* Medio de Transporte */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Medio de Transporte Habitual
                    </label>
                    <select
                      value={medioTransporte}
                      onChange={(e) => setMedioTransporte(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">-- Seleccionar --</option>
                      <option value="MOTO">MOTO</option>
                      <option value="CARRO">CARRO</option>
                      <option value="TRANSPORTE_PUBLICO">TRANSPORTE PÚBLICO</option>
                      <option value="A_PIE">A PIE</option>
                    </select>
                  </div>

                  {/* Placa Vehicular */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Placa Vehicular Asignada / Propia
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={placaVehiculo}
                      onChange={(e) => setPlacaVehiculo(e.target.value.toUpperCase())}
                      placeholder="Ej: ABC123"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs uppercase tracking-wider text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  {/* Modelo del Vehículo */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Marca, Línea y Modelo del Vehículo
                    </label>
                    <input
                      type="text"
                      value={modeloVehiculo}
                      onChange={(e) => setModeloVehiculo(e.target.value)}
                      placeholder="Ej: Yamaha XTZ 150 mod 2022 / Renault Duster 4x4"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Licencia de Conducción Digital */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Licencia de Conducción (Copia Digital Adjunta)
                    </h4>
                  </div>
                </div>

                <div className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
                  pendingDeletions.has("LICENCIA_CONDUCCION")
                    ? "border-red-300 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20"
                    : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                }`}>
                  <div>
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                      <span>Soporte Digital de Licencia de Conducción</span>
                      {(licenciaUrl || pendingFiles["LICENCIA_CONDUCCION"]) && !pendingDeletions.has("LICENCIA_CONDUCCION") && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </p>
                    {pendingFiles["LICENCIA_CONDUCCION"] ? (
                      <p className="text-2xs text-gray-600 dark:text-gray-300 font-mono mt-0.5 truncate max-w-[200px]" title={pendingFiles["LICENCIA_CONDUCCION"]?.name}>
                        {pendingFiles["LICENCIA_CONDUCCION"]?.name}
                      </p>
                    ) : pendingDeletions.has("LICENCIA_CONDUCCION") ? (
                      <p className="text-2xs text-red-600 dark:text-red-400 mt-0.5">Se eliminará al guardar</p>
                    ) : (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {licenciaUrl ? "Archivo digital cargado en el expediente" : "Sin documento adjunto"}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputLicenciaRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSelectPendingFile("LICENCIA_CONDUCCION", file);
                        e.target.value = "";
                      }}
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                    />
                    {pendingFiles["LICENCIA_CONDUCCION"] && pendingPreviews["LICENCIA_CONDUCCION"] ? (
                      <>
                        <a
                          href={pendingPreviews["LICENCIA_CONDUCCION"]!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                          title="Ver archivo"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Ver</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleClearPendingFile("LICENCIA_CONDUCCION")}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 transition-colors"
                          title="Descartar selección"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : pendingDeletions.has("LICENCIA_CONDUCCION") ? (
                      <button
                        type="button"
                        onClick={() => handleUndoDeletion("LICENCIA_CONDUCCION")}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-brand-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-brand-400"
                      >
                        <span>Deshacer</span>
                      </button>
                    ) : licenciaUrl ? (
                      <>
                        <a
                          href={getMediaUrl(licenciaUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                          title="Ver archivo"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Ver</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleMarkForDeletion("LICENCIA_CONDUCCION")}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400 transition-colors"
                          title="Eliminar archivo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => fileInputLicenciaRef.current?.click()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-brand-500 dark:bg-brand-500 dark:hover:bg-brand-400"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>
                        {pendingFiles["LICENCIA_CONDUCCION"]
                          ? "Cambiar"
                          : licenciaUrl && !pendingDeletions.has("LICENCIA_CONDUCCION")
                          ? "Cambiar"
                          : "Subir Licencia"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Footer Buttons */}
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
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
