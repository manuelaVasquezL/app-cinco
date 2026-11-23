// src/modules/infraestructura/personal/components/ModalCrearEmpleado.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  UserPlus,
  Loader2,
  Mail,
  Shield,
  Shirt,
  MapPin,
  User,
  Briefcase,
  Building2,
  Calendar,
  Phone,
  FileText,
  Car,
  Trash2,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import DatePicker from "@/components/form/date-picker";
import { personalService } from "../services/personalService";
import { usePersonalStore } from "../store/usePersonalStore";
import { AreasCarpetasResponse } from "@/types/empleado";
import { SearchableSupervisorSelect } from "./SearchableSupervisorSelect";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ContactoEmergenciaItem {
  id: string;
  nombre_completo: string;
  parentesco: string;
  telefono: string;
  es_principal: boolean;
}

interface PersonaACargoItem {
  id: string;
  nombre_completo: string;
  parentesco: string;
  tipo_documento: string;
  numero_documento: string;
  fecha_nacimiento: string;
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

const TIPOS_CONTRATO = [
  { value: "FIJO", label: "Término Fijo" },
  { value: "INDEFINIDO", label: "Término Indefinido" },
  { value: "OBRA_LABOR", label: "Por Obra o Labor" },
  { value: "APRENDIZ_SENA_LECTIVA", label: "Aprendiz SENA (Lectiva)" },
  { value: "APRENDIZ_SENA_PRODUCTIVA", label: "Aprendiz SENA (Productiva)" },
  { value: "PRESTACION_SERVICIOS", label: "Prestación de Servicios" },
  { value: "OTRO", label: "Otro" },
];

const TALLAS_CAMISA = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const TALLAS_PANTALON = ["28", "30", "32", "34", "36", "38", "40", "42"];
const TALLAS_CALZADO = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];
const MEDIOS_TRANSPORTE = [
  "MOTO",
  "CARRO",
  "CAMIONETA",
  "TRANSPORTE_PUBLICO",
  "BICICLETA",
  "A_PIE",
  "OTRO",
];

const toDateOrUndefined = (value?: string | null): Date | undefined => {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12);
};

function calcularSeisMesesDespues(fechaIso: string): string {
  if (!fechaIso) return "";
  const fechaInicio = new Date(fechaIso + "T00:00:00");
  if (isNaN(fechaInicio.getTime())) return "";

  const fechaFin = new Date(fechaInicio);
  fechaFin.setMonth(fechaFin.getMonth() + 6);

  if (fechaFin.getDate() !== fechaInicio.getDate()) {
    fechaFin.setDate(0);
  }

  const año = fechaFin.getFullYear();
  const mes = String(fechaFin.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaFin.getDate()).padStart(2, "0");

  return `${año}-${mes}-${dia}`;
}

const handleDateChange = (setter: (val: string) => void) => (dates: Date[] | Date) => {
  const selected = Array.isArray(dates) ? dates[0] : dates;
  if (selected instanceof Date && !isNaN(selected.getTime())) {
    const y = selected.getFullYear();
    const m = String(selected.getMonth() + 1).padStart(2, "0");
    const d = String(selected.getDate()).padStart(2, "0");
    setter(`${y}-${m}-${d}`);
  } else {
    setter("");
  }
};

export const ModalCrearEmpleado: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { fetchEmpleados, supervisores, fetchSupervisores } = usePersonalStore();
  const [activeTab, setActiveTab] = useState<
    "laboral" | "contacto" | "sst" | "dotacion" | "movilidad"
  >("laboral");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Catálogo dinámico de Áreas y Carpetas
  const [catalogoAreas, setCatalogoAreas] = useState<AreasCarpetasResponse | null>(null);

  useEffect(() => {
    if (isOpen) {
      const loadCatalogo = async () => {
        try {
          const res = await personalService.getAreasCarpetas();
          setCatalogoAreas(res);
        } catch {
          // fallback silencioso
        }
      };
      loadCatalogo();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchSupervisores();
    }
  }, [isOpen, fetchSupervisores]);

  // --- TAB 1: IDENTIFICACIÓN Y LABORAL ---
  const [tipoDoc, setTipoDoc] = useState("CC");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [primerNombre, setPrimerNombre] = useState("");
  const [segundoNombre, setSegundoNombre] = useState("");
  const [primerApellido, setPrimerApellido] = useState("");
  const [segundoApellido, setSegundoApellido] = useState("");
  const [pasaporte, setPasaporte] = useState(""); // CC SIIGO
  const [codigoSap, setCodigoSap] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [fechaExpedicionDoc, setFechaExpedicionDoc] = useState("");
  const [genero, setGenero] = useState<"MASCULINO" | "FEMENINO" | "OTRO">("MASCULINO");

  // Contrato y Sede
  const [sede, setSede] = useState("MEDELLIN");
  const [ciudadOperacion, setCiudadOperacion] = useState("MEDELLIN");
  const [tipoContrato, setTipoContrato] = useState("FIJO");
  const [duracionContrato, setDuracionContrato] = useState("");
  const [fechaInicioContrato, setFechaInicioContrato] = useState("");
  const [fechaFinContrato, setFechaFinContrato] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Ubicación Organizacional
  const [area, setArea] = useState("");
  const [carpeta, setCarpeta] = useState("");
  const [tipoLabor, setTipoLabor] = useState("OPERATIVO");
  const [cargo, setCargo] = useState("");
  const [funcionCargo, setFuncionCargo] = useState("");
  const [puesto, setPuesto] = useState("");
  const [zonaNodo, setZonaNodo] = useState("");
  const [movil, setMovil] = useState("");

  // Liderazgo y Formación
  const [supervisorId, setSupervisorId] = useState("");
  const [padrinoId, setPadrinoId] = useState("");
  const [formador, setFormador] = useState("");
  const [grupoComisiones, setGrupoComisiones] = useState("");
  const [nivelEstudio, setNivelEstudio] = useState("BACHILLER");
  const [etapaInduccion, setEtapaInduccion] = useState("EN_FORMACION");

  // Prácticas SENA
  const [practicaLectivaInicio, setPracticaLectivaInicio] = useState("");
  const [practicaLectivaFin, setPracticaLectivaFin] = useState("");
  const [practicaProductivaInicio, setPracticaProductivaInicio] = useState("");
  const [practicaProductivaFin, setPracticaProductivaFin] = useState("");

  // --- TAB 2: CONTACTO Y EMERGENCIAS ---
  const [correoCorporativo, setCorreoCorporativo] = useState("");
  const [correoPersonal, setCorreoPersonal] = useState("");
  const [celularCorporativo, setCelularCorporativo] = useState("");
  const [celularPersonal, setCelularPersonal] = useState("");
  const [celularAlterno, setCelularAlterno] = useState("");
  const [telefonoFijo, setTelefonoFijo] = useState("");
  const [direccionResidencia, setDireccionResidencia] = useState("");
  const [claroPay, setClaroPay] = useState("");

  // Lista dinámica de contactos de emergencia
  const [contactosEmergencia, setContactosEmergencia] = useState<ContactoEmergenciaItem[]>([]);
  const [nuevoContactoNombre, setNuevoContactoNombre] = useState("");
  const [nuevoContactoParentesco, setNuevoContactoParentesco] = useState("FAMILIAR");
  const [nuevoContactoTelefono, setNuevoContactoTelefono] = useState("");

  // --- TAB 3: SEGURIDAD SOCIAL, FAMILIA Y SST ---
  const [eps, setEps] = useState("SURA");
  const [arl, setArl] = useState("COLMENA");
  const [afp, setAfp] = useState("PORVENIR");
  const [esquemaVacunacion, setEsquemaVacunacion] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("SOLTERO");
  const [permisoTrabajo, setPermisoTrabajo] = useState("");
  const [vencimientoAlturas, setVencimientoAlturas] = useState("");
  const [vencimientoTecnico, setVencimientoTecnico] = useState("");

  // Personas a cargo
  const [personasACargo, setPersonasACargo] = useState<PersonaACargoItem[]>([]);
  const [nuevaPersonaNombre, setNuevaPersonaNombre] = useState("");
  const [nuevaPersonaParentesco, setNuevaPersonaParentesco] = useState("HIJO(A)");
  const [nuevaPersonaDoc, setNuevaPersonaDoc] = useState("");

  // --- TAB 4: DOTACIÓN ---
  const [tallaCamisa, setTallaCamisa] = useState("M");
  const [tallaPantalon, setTallaPantalon] = useState("32");
  const [tallaCalzado, setTallaCalzado] = useState("40");
  const [tallaChaqueta, setTallaChaqueta] = useState("");
  const [tallaGuerrera, setTallaGuerrera] = useState("");
  const [tieneCarnet, setTieneCarnet] = useState(false);
  const [fechaEntregaCarnet, setFechaEntregaCarnet] = useState("");

  // --- TAB 5: MOVILIDAD ---
  const [sabeConducir, setSabeConducir] = useState(false);
  const [medioTransporte, setMedioTransporte] = useState("");
  const [placaVehiculo, setPlacaVehiculo] = useState("");
  const [modeloVehiculo, setModeloVehiculo] = useState("");

  // Info automática de cuadrilla al escribir el móvil
  const handleMovilChange = async (val: string) => {
    setMovil(val);
    const cleanMovil = val.trim();
    if (!cleanMovil) return;

    try {
      const res = await personalService.getCuadrillaInfo(cleanMovil);
      if (res.existe_tecnico && res.tecnico) {
        if (res.tecnico.area) setArea(res.tecnico.area);
        if (res.tecnico.carpeta) setCarpeta(res.tecnico.carpeta);
        if (res.tecnico.supervisor_id) setSupervisorId(String(res.tecnico.supervisor_id));
        if (res.tecnico.medio_transporte) setMedioTransporte(res.tecnico.medio_transporte);
        toast.info(
          `Cuadrilla activa (${cleanMovil}): Datos heredados del técnico ${res.tecnico.nombre_completo}.`
        );
      }
    } catch {
      // Ignorar
    }
  };

  // Áreas y Carpetas disponibles
  const areasDisponibles = useMemo(() => {
    const lista = [...(catalogoAreas?.areas || [])];
    if (area && !lista.includes(area)) {
      lista.unshift(area);
    }
    return lista;
  }, [catalogoAreas, area]);

  const carpetasDisponibles = useMemo(() => {
    const lista =
      area && catalogoAreas?.carpetas_por_area?.[area]
        ? [...catalogoAreas.carpetas_por_area[area]]
        : [];
    if (carpeta && !lista.includes(carpeta)) {
      lista.unshift(carpeta);
    }
    return lista;
  }, [catalogoAreas, area, carpeta]);

  // Manejador de agregar contacto de emergencia
  const handleAgregarContacto = () => {
    if (!nuevoContactoNombre.trim() || !nuevoContactoTelefono.trim()) {
      toast.error("Ingrese nombre y teléfono del contacto de emergencia.");
      return;
    }
    setContactosEmergencia((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        nombre_completo: nuevoContactoNombre.trim(),
        parentesco: nuevoContactoParentesco.trim(),
        telefono: nuevoContactoTelefono.trim(),
        es_principal: prev.length === 0,
      },
    ]);
    setNuevoContactoNombre("");
    setNuevoContactoTelefono("");
    toast.success("Contacto de emergencia añadido.");
  };

  const handleEliminarContacto = (id: string) => {
    setContactosEmergencia((prev) => prev.filter((c) => c.id !== id));
  };

  // Manejador de agregar persona a cargo
  const handleAgregarPersona = () => {
    if (!nuevaPersonaNombre.trim()) {
      toast.error("Ingrese el nombre de la persona a cargo.");
      return;
    }
    setPersonasACargo((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        nombre_completo: nuevaPersonaNombre.trim(),
        parentesco: nuevaPersonaParentesco.trim(),
        tipo_documento: "RC",
        numero_documento: nuevaPersonaDoc.trim(),
        fecha_nacimiento: "",
      },
    ]);
    setNuevaPersonaNombre("");
    setNuevaPersonaDoc("");
    toast.success("Persona a cargo añadida.");
  };

  const handleEliminarPersona = (id: string) => {
    setPersonasACargo((prev) => prev.filter((p) => p.id !== id));
  };

  // Envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones obligatorias de contrato y personal
    if (!numeroDoc.trim() || !primerNombre.trim() || !primerApellido.trim()) {
      toast.error("Documento, Primer Nombre y Primer Apellido son obligatorios.");
      setActiveTab("laboral");
      return;
    }

    if (!cargo.trim() || !area.trim() || !carpeta.trim()) {
      toast.error("Cargo, Área y Carpeta son obligatorios.");
      setActiveTab("laboral");
      return;
    }

    if (!fechaIngreso) {
      toast.error("La fecha de ingreso laboral es requerida.");
      setActiveTab("laboral");
      return;
    }

    setIsSubmitting(true);
    try {
      const fullNombres = [primerNombre.trim(), segundoNombre.trim()]
        .filter(Boolean)
        .join(" ")
        .toUpperCase();
      const fullApellidos = [primerApellido.trim(), segundoApellido.trim()]
        .filter(Boolean)
        .join(" ")
        .toUpperCase();

      const payload = {
        tipo_documento: tipoDoc,
        numero_documento: numeroDoc.trim(),
        nombres: fullNombres,
        apellidos: fullApellidos,
        primer_nombre: primerNombre.trim().toUpperCase(),
        segundo_nombre: segundoNombre.trim().toUpperCase() || undefined,
        primer_apellido: primerApellido.trim().toUpperCase(),
        segundo_apellido: segundoApellido.trim().toUpperCase() || undefined,
        fecha_expedicion_documento: fechaExpedicionDoc || null,
        pasaporte: pasaporte.trim() || null,
        fecha_nacimiento: fechaNacimiento || null,
        genero: genero || null,
        estado_civil: estadoCivil || null,

        laboral: {
          cargo: cargo.trim().toUpperCase(),
          tipo_labor: tipoLabor,
          sede: sede.trim().toUpperCase() || "MEDELLIN",
          ciudad_operacion: ciudadOperacion.trim().toUpperCase() || sede.trim().toUpperCase() || "MEDELLIN",
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
          tipo_contrato: tipoContrato || null,
          duracion_contrato: duracionContrato.trim() || null,
          fecha_inicio_contrato: fechaInicioContrato || null,
          fecha_fin_contrato: fechaFinContrato || null,
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

        contactos_emergencia: contactosEmergencia.map((c) => ({
          nombre_completo: c.nombre_completo.trim().toUpperCase(),
          parentesco: c.parentesco.trim().toUpperCase(),
          telefono: c.telefono.trim(),
          es_principal: c.es_principal,
        })),

        personas_a_cargo: personasACargo.map((p) => ({
          nombre_completo: p.nombre_completo.trim().toUpperCase(),
          parentesco: p.parentesco.trim().toUpperCase(),
          tipo_documento: p.tipo_documento || "RC",
          numero_documento: p.numero_documento.trim() || null,
          fecha_nacimiento: p.fecha_nacimiento || null,
        })),

        seguridad_social: {
          eps: eps.trim() || null,
          arl: arl.trim() || "COLMENA",
          afp: afp.trim() || null,
          esquema_vacunacion: esquemaVacunacion.trim() || null,
        },

        certificaciones_sst: {
          permiso_trabajo: permisoTrabajo.trim() || null,
          vencimiento_alturas: vencimientoAlturas || null,
          vencimiento_tecnico: vencimientoTecnico || null,
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

      await personalService.createEmpleado(payload as any);
      toast.success("Colaborador registrado exitosamente en el sistema.");
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:items-center sm:p-4 overflow-y-auto animate-fade-in">
      {/* Overlay con fondo claro difuminado idéntico a ModalEditarPerfil / PersonalDetailModal */}
      <div
        className="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px] dark:bg-black/60 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Contenedor del Modal */}
      <div className="relative my-auto w-full max-w-3xl sm:max-w-4xl max-h-[88vh] overflow-y-auto overflow-x-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl transition-all dark:border-gray-800 dark:bg-gray-900">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Registrar Nuevo Colaborador
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Complete la información integral del empleado para dar inicio a su ciclo de vida.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pestañas de navegación idénticas a ModalEditarPerfil */}
        <div className="flex items-center border-b border-gray-100 pt-3 dark:border-gray-800 gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("laboral")}
            className={`flex shrink-0 items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "laboral"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>Laboral e Identidad</span>
            <span className="text-[10px] text-red-500 font-bold">*</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("contacto")}
            className={`flex shrink-0 items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "contacto"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
            }`}
          >
            <Phone className="h-3.5 w-3.5" />
            <span>Contacto y Emergencias</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sst")}
            className={`flex shrink-0 items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
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
            className={`flex shrink-0 items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "dotacion"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
            }`}
          >
            <Shirt className="h-3.5 w-3.5" />
            <span>Dotación y Tallas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("movilidad")}
            className={`flex shrink-0 items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "movilidad"
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
            }`}
          >
            <Car className="h-3.5 w-3.5" />
            <span>Movilidad</span>
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6 pt-5">
          {/* ============================================================== */}
          {/* PESTAÑA 1: LABORAL E IDENTIDAD */}
          {/* ============================================================== */}
          {activeTab === "laboral" && (
            <div className="space-y-6">
              {/* Bloque 1: Identificación y Datos Personales */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <User className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Datos de Identificación y Personales
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Tipo Doc <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={tipoDoc}
                      onChange={(e) => setTipoDoc(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="CC">Cédula de Ciudadanía (CC)</option>
                      <option value="CE">Cédula de Extranjería (CE)</option>
                      <option value="PASAPORTE">Pasaporte</option>
                      <option value="PPT">Permiso Protección Temporal (PPT)</option>
                      <option value="PEP">Permiso Especial Permanencia (PEP)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Número Documento <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={numeroDoc}
                      onChange={(e) => setNumeroDoc(e.target.value)}
                      placeholder="Ej: 1020304050"
                      required
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Fecha Expedición
                    </label>
                    <DatePicker
                      id="crear_fecha_expedicion"
                      placeholder="AAAA-MM-DD"
                      defaultDate={toDateOrUndefined(fechaExpedicionDoc)}
                      onChange={handleDateChange(setFechaExpedicionDoc)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Cédula SIIGO / Alterno
                    </label>
                    <input
                      type="text"
                      value={pasaporte}
                      onChange={(e) => setPasaporte(e.target.value)}
                      placeholder="Cédula SIIGO"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Primer Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={primerNombre}
                      onChange={(e) => setPrimerNombre(e.target.value.toUpperCase())}
                      placeholder="Ej: JUAN"
                      required
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Segundo Nombre
                    </label>
                    <input
                      type="text"
                      value={segundoNombre}
                      onChange={(e) => setSegundoNombre(e.target.value.toUpperCase())}
                      placeholder="Ej: CARLOS"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Primer Apellido <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={primerApellido}
                      onChange={(e) => setPrimerApellido(e.target.value.toUpperCase())}
                      placeholder="Ej: PÉREZ"
                      required
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Segundo Apellido
                    </label>
                    <input
                      type="text"
                      value={segundoApellido}
                      onChange={(e) => setSegundoApellido(e.target.value.toUpperCase())}
                      placeholder="Ej: GÓMEZ"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Fecha Nacimiento
                    </label>
                    <DatePicker
                      id="crear_fecha_nacimiento"
                      placeholder="AAAA-MM-DD"
                      defaultDate={toDateOrUndefined(fechaNacimiento)}
                      onChange={handleDateChange(setFechaNacimiento)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Género
                    </label>
                    <select
                      value={genero}
                      onChange={(e) => setGenero(e.target.value as any)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMENINO">Femenino</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Estado Civil
                    </label>
                    <select
                      value={estadoCivil}
                      onChange={(e) => setEstadoCivil(e.target.value as any)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="SOLTERO">Soltero(a)</option>
                      <option value="CASADO">Casado(a)</option>
                      <option value="UNION_LIBRE">Unión Libre</option>
                      <option value="DIVORCIADO">Divorciado(a)</option>
                      <option value="VIUDO">Viudo(a)</option>
                      <option value="OTRO">Otro</option>
                    </select>
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
                      {NIVELES_ESTUDIO.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Bloque 2: Ubicación Organizacional y Operativa */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <Building2 className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Ubicación Organizacional y Operativa
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Sede Principal <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={sede}
                      onChange={(e) => {
                        setSede(e.target.value);
                        setCiudadOperacion(e.target.value);
                      }}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      {SEDES_COLOMBIA.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Ciudad de Operación
                    </label>
                    <input
                      type="text"
                      value={ciudadOperacion}
                      onChange={(e) => setCiudadOperacion(e.target.value.toUpperCase())}
                      placeholder="Ej: MEDELLIN"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Área <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={area}
                      onChange={(e) => {
                        setArea(e.target.value);
                        setCarpeta("");
                      }}
                      required
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Seleccionar área...</option>
                      {areasDisponibles.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Carpeta <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={carpeta}
                      onChange={(e) => setCarpeta(e.target.value)}
                      required
                      disabled={!area}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:opacity-50"
                    >
                      <option value="">
                        {area ? "Seleccionar carpeta..." : "Primero seleccione un área"}
                      </option>
                      {carpetasDisponibles.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Tipo de Labor <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={tipoLabor}
                      onChange={(e) => setTipoLabor(e.target.value)}
                      required
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs font-medium text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="OPERATIVO">OPERATIVO</option>
                      <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
                      <option value="SUPERVISOR">SUPERVISOR</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Código SAP
                    </label>
                    <input
                      type="text"
                      value={codigoSap}
                      onChange={(e) => setCodigoSap(e.target.value)}
                      placeholder="Ej: SAP-00123"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Móvil
                    </label>
                    <input
                      type="text"
                      value={movil}
                      onChange={(e) => handleMovilChange(e.target.value)}
                      placeholder="Ej: 104, 301, T-05..."
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Función del Cargo
                    </label>
                    <input
                      type="text"
                      value={funcionCargo}
                      onChange={(e) => setFuncionCargo(e.target.value)}
                      placeholder="Ej: LIDER DE CUADRILLA"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Puesto / Estación
                    </label>
                    <input
                      type="text"
                      value={puesto}
                      onChange={(e) => setPuesto(e.target.value)}
                      placeholder="Ej: Estación 4"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Zona / Nodo
                    </label>
                    <input
                      type="text"
                      value={zonaNodo}
                      onChange={(e) => setZonaNodo(e.target.value)}
                      placeholder="Ej: ZONA NORTE"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Bloque 3: Condiciones Contractuales, Jerarquía y Formación */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <FileText className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Condiciones Contractuales, Jerarquía y Formación
                  </h4>
                </div>

                {/* Subsección: Contrato Laboral */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Tipo de Contrato <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={tipoContrato}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTipoContrato(val);
                        if (val === "INDEFINIDO") {
                          setDuracionContrato("INDEFINIDO");
                          setFechaFinContrato("");
                        }
                      }}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      {TIPOS_CONTRATO.map((tc) => (
                        <option key={tc.value} value={tc.value}>
                          {tc.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Duración Contrato
                    </label>
                    <input
                      type="text"
                      value={duracionContrato}
                      onChange={(e) => setDuracionContrato(e.target.value)}
                      disabled={tipoContrato === "INDEFINIDO"}
                      placeholder={tipoContrato === "INDEFINIDO" ? "No aplica (Indefinido)" : "Ej: 6 Meses, 1 Año..."}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white disabled:bg-gray-100 disabled:opacity-60 dark:disabled:bg-gray-800/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Fecha Inicio Contrato
                    </label>
                    <DatePicker
                      id="crear_fecha_inicio_contrato"
                      placeholder="AAAA-MM-DD"
                      defaultDate={toDateOrUndefined(fechaInicioContrato)}
                      onChange={handleDateChange(setFechaInicioContrato)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Fecha Fin Contrato
                    </label>
                    <DatePicker
                      id="crear_fecha_fin_contrato"
                      placeholder={tipoContrato === "INDEFINIDO" ? "No aplica (Indefinido)" : "AAAA-MM-DD"}
                      defaultDate={toDateOrUndefined(fechaFinContrato)}
                      onChange={handleDateChange(setFechaFinContrato)}
                    />
                  </div>
                </div>

                {/* Subsección: Fechas e Inducción */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Fecha Efectiva de Ingreso <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      id="crear_fecha_ingreso"
                      placeholder="AAAA-MM-DD"
                      defaultDate={toDateOrUndefined(fechaIngreso)}
                      onChange={(dates) => {
                        const selected = Array.isArray(dates) ? dates[0] : dates;
                        if (selected instanceof Date && !isNaN(selected.getTime())) {
                          const y = selected.getFullYear();
                          const m = String(selected.getMonth() + 1).padStart(2, "0");
                          const d = String(selected.getDate()).padStart(2, "0");
                          const iso = `${y}-${m}-${d}`;
                          setFechaIngreso(iso);
                          if (!fechaInicioContrato) {
                            setFechaInicioContrato(iso);
                          }
                        } else {
                          setFechaIngreso("");
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
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs font-semibold text-brand-600 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-brand-400"
                    >
                      <option value="EN_FORMACION">EN FORMACIÓN (GH / ESCUELA)</option>
                      <option value="ACOMPANAMIENTO">ACOMPAÑAMIENTO EN CAMPO</option>
                      <option value="PRODUCCION">PRODUCCIÓN DIRECTA</option>
                    </select>
                  </div>
                </div>

                {/* Subsección: Liderazgo y Supervisión */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SearchableSupervisorSelect
                    label="Supervisor / Jefe Directo"
                    value={supervisorId}
                    onChange={setSupervisorId}
                    supervisores={supervisores}
                    areaFiltro={area}
                    placeholder="Buscar supervisor por nombre, cargo o CC..."
                    emptyText="Sin supervisor asignado"
                  />

                  <SearchableSupervisorSelect
                    label="Padrino"
                    value={padrinoId}
                    onChange={setPadrinoId}
                    supervisores={supervisores}
                    areaFiltro={area}
                    placeholder="Buscar padrino por nombre, cargo o CC..."
                    emptyText="Sin padrino asignado"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Formador GH / Técnico
                    </label>
                    <input
                      type="text"
                      value={formador}
                      onChange={(e) => setFormador(e.target.value)}
                      placeholder="Nombre del formador"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Grupo Comisiones
                    </label>
                    <input
                      type="text"
                      value={grupoComisiones}
                      onChange={(e) => setGrupoComisiones(e.target.value)}
                      placeholder="Ej: FIBRA-01"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Aprendices SENA / Prácticas */}
                <div className="pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                  <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 block mb-2">
                    Etapas de Prácticas SENA / Convenio
                  </span>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60 space-y-2">
                      <span className="text-2xs font-bold uppercase text-gray-500 dark:text-gray-400">
                        Etapa Lectiva
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-2xs text-gray-400 block mb-0.5">Inicio</label>
                          <DatePicker
                            id="crear_practica_lectiva_inicio"
                            placeholder="Inicio"
                            defaultDate={toDateOrUndefined(practicaLectivaInicio)}
                            onChange={(dates) => {
                              const selected = Array.isArray(dates) ? dates[0] : dates;
                              if (selected instanceof Date && !isNaN(selected.getTime())) {
                                const y = selected.getFullYear();
                                const m = String(selected.getMonth() + 1).padStart(2, "0");
                                const d = String(selected.getDate()).padStart(2, "0");
                                const iso = `${y}-${m}-${d}`;
                                setPracticaLectivaInicio(iso);
                                if (!practicaLectivaFin) {
                                  setPracticaLectivaFin(calcularSeisMesesDespues(iso));
                                }
                              } else {
                                setPracticaLectivaInicio("");
                              }
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-2xs text-gray-400 block mb-0.5">Fin</label>
                          <DatePicker
                            id="crear_practica_lectiva_fin"
                            placeholder="Fin"
                            defaultDate={toDateOrUndefined(practicaLectivaFin)}
                            onChange={handleDateChange(setPracticaLectivaFin)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60 space-y-2">
                      <span className="text-2xs font-bold uppercase text-gray-500 dark:text-gray-400">
                        Etapa Productiva
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-2xs text-gray-400 block mb-0.5">Inicio</label>
                          <DatePicker
                            id="crear_practica_productiva_inicio"
                            placeholder="Inicio"
                            defaultDate={toDateOrUndefined(practicaProductivaInicio)}
                            onChange={(dates) => {
                              const selected = Array.isArray(dates) ? dates[0] : dates;
                              if (selected instanceof Date && !isNaN(selected.getTime())) {
                                const y = selected.getFullYear();
                                const m = String(selected.getMonth() + 1).padStart(2, "0");
                                const d = String(selected.getDate()).padStart(2, "0");
                                const iso = `${y}-${m}-${d}`;
                                setPracticaProductivaInicio(iso);
                                if (!practicaProductivaFin) {
                                  setPracticaProductivaFin(calcularSeisMesesDespues(iso));
                                }
                              } else {
                                setPracticaProductivaInicio("");
                              }
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-2xs text-gray-400 block mb-0.5">Fin</label>
                          <DatePicker
                            id="crear_practica_productiva_fin"
                            placeholder="Fin"
                            defaultDate={toDateOrUndefined(practicaProductivaFin)}
                            onChange={handleDateChange(setPracticaProductivaFin)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 2: CONTACTO Y EMERGENCIAS */}
          {/* ============================================================== */}
          {activeTab === "contacto" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <Phone className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Líneas Telefónicas y Dirección
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Celular Corporativo
                    </label>
                    <input
                      type="text"
                      value={celularCorporativo}
                      onChange={(e) => setCelularCorporativo(e.target.value)}
                      placeholder="Ej: 3001234567"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Celular Personal
                    </label>
                    <input
                      type="text"
                      value={celularPersonal}
                      onChange={(e) => setCelularPersonal(e.target.value)}
                      placeholder="Ej: 3109876543"
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
                      placeholder="Ej: 3205550011"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Teléfono Fijo
                    </label>
                    <input
                      type="text"
                      value={telefonoFijo}
                      onChange={(e) => setTelefonoFijo(e.target.value)}
                      placeholder="Ej: 6044445566"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Número Claro Pay
                    </label>
                    <input
                      type="text"
                      value={claroPay}
                      onChange={(e) => setClaroPay(e.target.value)}
                      placeholder="Ej: 3001234567"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Dirección de Residencia
                    </label>
                    <input
                      type="text"
                      value={direccionResidencia}
                      onChange={(e) => setDireccionResidencia(e.target.value)}
                      placeholder="Ej: Calle 50 # 40-20 Apto 301"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Correo Corporativo
                    </label>
                    <input
                      type="email"
                      value={correoCorporativo}
                      onChange={(e) => setCorreoCorporativo(e.target.value)}
                      placeholder="nombre.apellido@empresa.com"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Correo Personal
                    </label>
                    <input
                      type="email"
                      value={correoPersonal}
                      onChange={(e) => setCorreoPersonal(e.target.value)}
                      placeholder="personal@gmail.com"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Bloque: Contactos de Emergencia */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Contactos de Emergencia
                    </h4>
                  </div>
                  <span className="text-2xs text-gray-400">
                    {contactosEmergencia.length} registrado(s)
                  </span>
                </div>

                {/* Formulario rápido para añadir */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 p-3 rounded-lg bg-white dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={nuevoContactoNombre}
                      onChange={(e) => setNuevoContactoNombre(e.target.value.toUpperCase())}
                      placeholder="Nombre Completo..."
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={nuevoContactoParentesco}
                      onChange={(e) => setNuevoContactoParentesco(e.target.value.toUpperCase())}
                      placeholder="Parentesco (Ej: MADRE)"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nuevoContactoTelefono}
                      onChange={(e) => setNuevoContactoTelefono(e.target.value)}
                      placeholder="Teléfono..."
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAgregarContacto}
                      className="h-8 px-3 shrink-0 rounded-lg bg-brand-600 text-white hover:bg-brand-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Lista de contactos agregados */}
                {contactosEmergencia.length > 0 ? (
                  <div className="space-y-2">
                    {contactosEmergencia.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 text-xs"
                      >
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">
                            {c.nombre_completo}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {c.parentesco} • Tel: {c.telefono}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEliminarContacto(c.id)}
                          className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic text-center py-2">
                    No se han agregado contactos de emergencia aún.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 3: SEGURIDAD SOCIAL Y SST */}
          {/* ============================================================== */}
          {activeTab === "sst" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <Shield className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Afiliaciones de Seguridad Social
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      EPS
                    </label>
                    <select
                      value={eps}
                      onChange={(e) => setEps(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      {EPS_COLOMBIA.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      ARL
                    </label>
                    <select
                      value={arl}
                      onChange={(e) => setArl(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      {ARL_COLOMBIA.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Fondo de Pensiones (AFP)
                    </label>
                    <select
                      value={afp}
                      onChange={(e) => setAfp(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      {AFP_COLOMBIA.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Estado Civil
                    </label>
                    <select
                      value={estadoCivil}
                      onChange={(e) => setEstadoCivil(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="SOLTERO">Soltero(a)</option>
                      <option value="CASADO">Casado(a)</option>
                      <option value="UNION_LIBRE">Unión Libre</option>
                      <option value="DIVORCIADO">Divorciado(a)</option>
                      <option value="VIUDO">Viudo(a)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Esquema de Vacunación (Resumen)
                    </label>
                    <input
                      type="text"
                      value={esquemaVacunacion}
                      onChange={(e) => setEsquemaVacunacion(e.target.value)}
                      placeholder="Ej: COVID 3 dosis, Tétano al día..."
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Bloque: Certificaciones SST */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <Shield className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Certificaciones de Seguridad y Salud (SST)
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Permiso de Trabajo
                    </label>
                    <input
                      type="text"
                      value={permisoTrabajo}
                      onChange={(e) => setPermisoTrabajo(e.target.value)}
                      placeholder="Ej: RES-1409 / ALTURAS"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Vencimiento Alturas
                    </label>
                    <DatePicker
                      id="crear_vencimiento_alturas"
                      placeholder="AAAA-MM-DD"
                      defaultDate={toDateOrUndefined(vencimientoAlturas)}
                      onChange={handleDateChange(setVencimientoAlturas)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Vencimiento Técnico
                    </label>
                    <DatePicker
                      id="crear_vencimiento_tecnico"
                      placeholder="AAAA-MM-DD"
                      defaultDate={toDateOrUndefined(vencimientoTecnico)}
                      onChange={handleDateChange(setVencimientoTecnico)}
                    />
                  </div>
                </div>
              </div>

              {/* Bloque: Personas a Cargo */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Personas a Cargo / Beneficiarios
                    </h4>
                  </div>
                  <span className="text-2xs text-gray-400">
                    {personasACargo.length} registrado(s)
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 p-3 rounded-lg bg-white dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={nuevaPersonaNombre}
                      onChange={(e) => setNuevaPersonaNombre(e.target.value.toUpperCase())}
                      placeholder="Nombre Completo..."
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={nuevaPersonaParentesco}
                      onChange={(e) => setNuevaPersonaParentesco(e.target.value.toUpperCase())}
                      placeholder="Parentesco (Ej: HIJO)"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nuevaPersonaDoc}
                      onChange={(e) => setNuevaPersonaDoc(e.target.value)}
                      placeholder="Documento / TI..."
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAgregarPersona}
                      className="h-8 px-3 shrink-0 rounded-lg bg-brand-600 text-white hover:bg-brand-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {personasACargo.length > 0 && (
                  <div className="space-y-2">
                    {personasACargo.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 text-xs"
                      >
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">
                            {p.nombre_completo}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {p.parentesco} • Doc: {p.numero_documento || "N/A"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEliminarPersona(p.id)}
                          className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 4: DOTACIÓN Y TALLAS */}
          {/* ============================================================== */}
          {activeTab === "dotacion" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <Shirt className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Tallas de Dotación
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Talla Camisa
                    </label>
                    <select
                      value={tallaCamisa}
                      onChange={(e) => setTallaCamisa(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      {TALLAS_CAMISA.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Talla Pantalón
                    </label>
                    <select
                      value={tallaPantalon}
                      onChange={(e) => setTallaPantalon(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      {TALLAS_PANTALON.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Talla Calzado / Botas
                    </label>
                    <select
                      value={tallaCalzado}
                      onChange={(e) => setTallaCalzado(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      {TALLAS_CALZADO.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Talla Chaqueta
                    </label>
                    <input
                      type="text"
                      value={tallaChaqueta}
                      onChange={(e) => setTallaChaqueta(e.target.value.toUpperCase())}
                      placeholder="Ej: M, L..."
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Talla Guerrera
                    </label>
                    <input
                      type="text"
                      value={tallaGuerrera}
                      onChange={(e) => setTallaGuerrera(e.target.value.toUpperCase())}
                      placeholder="Ej: M, L..."
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="tieneCarnetCheck"
                      checked={tieneCarnet}
                      onChange={(e) => setTieneCarnet(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <label
                      htmlFor="tieneCarnetCheck"
                      className="text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer"
                    >
                      ¿Se le ha entregado carnet corporativo?
                    </label>
                  </div>

                  {tieneCarnet && (
                    <div className="w-48">
                      <DatePicker
                        id="crear_fecha_entrega_carnet"
                        placeholder="AAAA-MM-DD"
                        defaultDate={toDateOrUndefined(fechaEntregaCarnet)}
                        onChange={handleDateChange(setFechaEntregaCarnet)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 5: MOVILIDAD */}
          {/* ============================================================== */}
          {activeTab === "movilidad" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-700/60">
                  <Car className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Datos de Conducción y Vehículo
                  </h4>
                </div>

                <div className="flex items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    id="sabeConducirCheck"
                    checked={sabeConducir}
                    onChange={(e) => setSabeConducir(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <label
                    htmlFor="sabeConducirCheck"
                    className="text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    ¿Sabe conducir vehículo / moto de la empresa?
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Medio de Transporte
                    </label>
                    <select
                      value={medioTransporte}
                      onChange={(e) => setMedioTransporte(e.target.value)}
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">Seleccionar medio...</option>
                      {MEDIOS_TRANSPORTE.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Placa del Vehículo
                    </label>
                    <input
                      type="text"
                      value={placaVehiculo}
                      onChange={(e) => setPlacaVehiculo(e.target.value.toUpperCase())}
                      placeholder="Ej: ABC123"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs uppercase text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Modelo / Año Vehículo
                    </label>
                    <input
                      type="text"
                      value={modeloVehiculo}
                      onChange={(e) => setModeloVehiculo(e.target.value)}
                      placeholder="Ej: 2022"
                      className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Buttons idénticos a ModalEditarPerfil */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 rounded-lg px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 focus:outline-hidden disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  <span>Registrar Colaborador</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
