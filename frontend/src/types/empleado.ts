// src/types/empleado.ts

// ==========================================
// Tipos Heredados (compatibilidad con certificados y búsqueda)
// ==========================================
export interface Empleado {
  id: number;
  cedula: string;
  nombre: string;
  apellido: string;
  area?: string;
  carpeta?: string;
  cargo?: string;
  movil?: string;
  supervisor?: string;
  estado: string;
  link_foto?: string;
  fecha_ingreso?: string;
  fecha_egreso?: string;
  genero?: string;
}

export interface EmpleadoSearchResult {
  id: number;
  cedula: string;
  nombre: string;
  apellido: string;
  cargo?: string;
  movil?: string;
  link_foto?: string;
}

// ==========================================
// Nuevos Tipos Normalizados - Base de Personal 360°
// ==========================================

export type EstadoEmpleado = 'ACTIVO' | 'INACTIVO' | 'EN_FORMACION' | 'SUSPENDIDO';
export type EtapaInduccion = 'EN_FORMACION' | 'APROBADO_GH' | 'ENTREGADO' | 'RECHAZADO';
export type TipoContrato = 'OBRA_LABOR' | 'FIJO' | 'INDEFINIDO' | 'APRENDIZAJE' | 'PRESTACION';

export interface EmpleadoLaboral {
  id?: number;
  empleado_id?: number;
  cargo: string;
  area: string;
  carpeta: string;
  sede?: string | null;
  ciudad_operacion?: string;
  tipo_contrato?: TipoContrato | string;
  fecha_ingreso: string;
  fecha_fin_contrato?: string | null;
  fecha_retiro?: string | null;
  fecha_egreso?: string | null;
  motivo_egreso?: string | null;
  motivo_egreso_real?: string | null;
  fecha_entrega_area?: string | null;
  salario_base?: number | string;
  auxilio_transporte?: boolean;
  tipo_labor?: string | null;
  codigo_sap?: string | null;
  puesto?: string | null;
  funcion_cargo?: string | null;
  zona_nodo?: string | null;
  grupo_comisiones?: string | null;
  nivel_estudio?: string | null;
  supervisor?: number | null;
  supervisor_nombre?: string | null;
  supervisor_directo_id?: number | null;
  supervisor_directo_nombre?: string | null;
  padrino?: number | null;
  padrino_nombre?: string | null;
  formador?: string | null;
  entregado_por?: number | null;
  entregado_por_nombre?: string | null;
  dias_para_periodo_prueba?: number | null;
  auxilio_movilizacion?: number | string;
  bono_fijo?: number | string;
  bono_variable?: number | string;
  etapa_induccion: EtapaInduccion | string;
  fecha_entrega_operaciones?: string | null;
  fecha_aprobacion_gh?: string | null;
  movil?: string | null;
  cuadrilla_padre_id?: number | null;
  motivo_retiro_gh?: string | null;
  motivo_retiro_operaciones?: string | null;
  practica_lectiva_inicio?: string | null;
  practica_lectiva_fin?: string | null;
  practica_productiva_inicio?: string | null;
  practica_productiva_fin?: string | null;
}

export interface EmpleadoContacto {
  id?: number;
  empleado_id?: number;
  telefono_personal?: string | null;
  telefono_corporativo?: string | null;
  celular_personal?: string | null;
  celular_corporativo?: string | null;
  celular_alterno?: string | null;
  telefono_fijo?: string | null;
  email_personal?: string | null;
  email_corporativo?: string | null;
  correo_personal?: string | null;
  correo_corporativo?: string | null;
  correo_personal_verificado?: boolean;
  direccion_residencia?: string | null;
  claro_pay?: string | null;
  barrio?: string | null;
  ciudad_residencia?: string | null;
  departamento_residencia?: string | null;
}

export interface EmpleadoSeguridadSocial {
  id?: number;
  empleado_id?: number;
  eps?: string | null;
  afp?: string | null;
  afp_pensiones?: string | null;
  arl?: string | null;
  ccf_caja_compensacion?: string | null;
  fondo_cesantias?: string | null;
  tipo_sangre_rh?: string | null;
  alergias_restricciones?: string | null;
}

export interface EmpleadoCertificacionesSST {
  id?: number;
  empleado_id?: number;
  permiso_trabajo?: string | null;
  certificado_alturas_url?: string | null;
  vencimiento_alturas?: string | null;
  estado_alturas?: string | null;
  certificado_tecnico_url?: string | null;
  vencimiento_tecnico?: string | null;
  estado_tecnico?: string | null;
  curso_alturas_nivel?: string | null;
  curso_alturas_fecha_vence?: string | null;
  espacios_confinados_nivel?: string | null;
  espacios_confinados_fecha_vence?: string | null;
  examen_medico_tipo?: string | null;
  examen_medico_fecha_vence?: string | null;
  vacuna_tetano?: boolean;
  vacuna_fiebre_amarilla?: boolean;
  vacuna_hepatitis_b?: boolean;
  vacunas_observaciones?: string | null;
}

export interface EmpleadoDotacionActivos {
  id?: number;
  empleado_id?: number;
  tiene_carnet?: boolean;
  fecha_entrega_carnet?: string | null;
  talla_camisa?: string | null;
  talla_pantalon?: string | null;
  talla_calzado?: string | null;
  talla_chaqueta?: string | null;
  talla_guerrera?: string | null;
}

export interface EmpleadoMovilidad {
  id?: number;
  empleado_id?: number;
  sabe_conducir: boolean;
  medio_transporte?: string | null;
  modelo_vehiculo?: string | null;
  placa_vehiculo?: string | null;
  // Campos visuales legacy / opcionales para compatibilidad
  tiene_licencia_conduccion?: boolean;
  licencia_categoria?: string | null;
  licencia_fecha_vence?: string | null;
  vehiculo_asignado_tipo?: string | null;
  vehiculo_propio?: boolean;
  observaciones_vehiculo?: string | null;
}

export interface EmpleadoCuentaBancaria {
  id?: number;
  empleado_id?: number;
  banco: string;
  tipo_cuenta: 'AHORROS' | 'CORRIENTE' | string;
  numero_cuenta: string;
  es_nomina: boolean;
  fecha_registro?: string;
  activo?: boolean;
}

export interface EmpleadoContactoEmergencia {
  id?: number;
  empleado_id?: number;
  nombre_completo: string;
  parentesco: 'PADRE' | 'MADRE' | 'CONYUGE' | 'HIJO' | 'HERMANO' | 'OTRO' | string;
  telefono: string;
  es_principal: boolean;
  // Aliases legacy de retrocompatibilidad
  nombre_contacto?: string;
  telefono_principal?: string;
  telefono_secundario?: string | null;
}

export interface GestionarContactoEmergenciaPayload {
  contacto_id?: number;
  nombre_completo: string;
  parentesco: string;
  telefono: string;
  es_principal?: boolean;
}

export interface EmpleadoPersonaACargo {
  id?: number;
  empleado_id?: number;
  nombre_completo: string;
  parentesco: string;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  fecha_nacimiento?: string | null;
}

export interface EmpleadoDocumentoAdjunto {
  id?: number;
  empleado_id?: number;
  tipo_documento?: string;
  tipo_documento_id?: number | null;
  nombre_tipo_documento?: string | null;
  archivo_url: string;
  fecha_subida?: string;
}

export interface EmpleadoAuditoriaLog {
  id?: number;
  empleado_id?: number;
  modulo?: string;
  accion: string;
  tabla_afectada?: string;
  valores_anteriores?: Record<string, unknown> | null;
  valores_nuevos?: Record<string, unknown> | null;
  datos_anteriores?: Record<string, unknown> | null;
  datos_nuevos?: Record<string, unknown> | null;
  usuario?: number | null;
  usuario_id?: number | null;
  usuario_nombre?: string | null;
  fecha_evento?: string;
  created_at?: string;
  ip_origen?: string | null;
  direccion_ip?: string | null;
}

// ==========================================
// Ficha Resumen (Lista) y Ficha Completa (Detalle)
// ==========================================

export interface EmpleadoPerfilItem {
  id: number;
  tipo_documento: string;
  numero_documento: string;
  primer_nombre?: string;
  segundo_nombre?: string | null;
  primer_apellido?: string;
  segundo_apellido?: string | null;
  nombres?: string;
  apellidos?: string;
  nombre_completo: string;
  genero?: string | null;
  estado: EstadoEmpleado;
  foto_url?: string | null;
  foto_perfil_url?: string | null;
  
  // Resumen laboral
  cargo?: string | null;
  area?: string | null;
  carpeta?: string | null;
  sede?: string | null;
  ciudad_operacion?: string | null;
  tipo_contrato?: string | null;
  fecha_ingreso?: string | null;
  fecha_retiro?: string | null;
  movil?: string | null;
  etapa_induccion?: EtapaInduccion | string | null;
  supervisor_directo_nombre?: string | null;

  // Resumen movilidad
  placa_vehiculo?: string | null;
  vehiculo_asignado_tipo?: string | null;

  // Métricas calculadas
  dias_en_empresa: number;
  en_periodo_prueba: boolean;
  proximo_a_vencer_contrato: boolean;
  documentos_completos: boolean;
}

export interface EmpleadoPerfilCompleto {
  id: number;
  user_id?: number | null;
  tipo_documento: string;
  numero_documento: string;
  fecha_expedicion_documento?: string | null;
  fecha_expedicion_doc?: string | null;
  lugar_expedicion_doc?: string | null;
  pasaporte?: string | null;
  nombres?: string;
  apellidos?: string;
  primer_nombre?: string;
  segundo_nombre?: string | null;
  primer_apellido?: string;
  segundo_apellido?: string | null;
  nombre_completo?: string;
  fecha_nacimiento?: string | null;
  genero?: string | null;
  estado_civil?: string | null;
  nivel_educativo?: string | null;
  estado: EstadoEmpleado;
  foto_perfil_url?: string | null;
  foto_url?: string | null;
  created_at?: string;
  updated_at?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;

  // Resumen plano compatible
  cargo?: string | null;
  area?: string | null;
  ciudad_operacion?: string | null;
  movil?: string | null;
  placa_vehiculo?: string | null;
  vehiculo_asignado_tipo?: string | null;

  // Satélites 1-a-1
  laboral?: EmpleadoLaboral;
  contacto?: EmpleadoContacto;
  seguridad_social?: EmpleadoSeguridadSocial;
  sst?: EmpleadoCertificacionesSST;
  certificaciones_sst?: EmpleadoCertificacionesSST;
  dotacion?: EmpleadoDotacionActivos;
  dotacion_activos?: EmpleadoDotacionActivos;
  movilidad?: EmpleadoMovilidad;

  // Satélites 1-a-N
  cuentas_bancarias?: EmpleadoCuentaBancaria[];
  contactos_emergencia?: EmpleadoContactoEmergencia[];
  personas_a_cargo?: EmpleadoPersonaACargo[];
  documentos_adjuntos?: EmpleadoDocumentoAdjunto[];

  // Métricas
  dias_en_empresa?: number;
  en_periodo_prueba?: boolean;
  proximo_a_vencer_contrato?: boolean;
  documentos_completos?: boolean;
}

// ==========================================
// Payloads para Acciones de Dominio
// ==========================================

export interface EntregaGHPayload {
  lider_operaciones_id: number;
  movil_asignado: string;
  fecha_entrega?: string;
  observaciones?: string;
}

export interface AsignarPlacaPayload {
  placa: string;
  sabe_conducir?: boolean;
  conduce?: boolean;
  medio_transporte?: string;
  modelo_vehiculo?: string;
  // Campos legacy opcionales
  tipo_vehiculo?: string;
  es_propio?: boolean;
  observaciones?: string;
}

export interface DesactivarEmpleadoPayload {
  motivo_retiro_gh: string;
  motivo_retiro_operaciones: string;
  fecha_retiro?: string;
}

export interface ReactivarEmpleadoPayload {
  observaciones?: string;
}

export interface GestionarCuentaBancariaPayload {
  banco: string;
  tipo_cuenta: 'AHORROS' | 'CORRIENTE' | string;
  numero_cuenta: string;
  es_nomina?: boolean;
}

export interface PersonalFilterParams {
  search?: string;
  estado?: EstadoEmpleado | string;
  ciudad?: string;
  cargo?: string;
  supervisor_id?: number | string;
  etapa_induccion?: string;
  movil?: string;
  ordering?: string;
}
