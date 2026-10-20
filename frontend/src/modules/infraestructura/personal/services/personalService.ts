// src/modules/infraestructura/personal/services/personalService.ts
import api from "@/lib/api";
import {
  EmpleadoPerfilItem,
  EmpleadoPerfilCompleto,
  EntregaGHPayload,
  AsignarPlacaPayload,
  DesactivarEmpleadoPayload,
  ReactivarEmpleadoPayload,
  GestionarCuentaBancariaPayload,
  EmpleadoCuentaBancaria,
  EmpleadoAuditoriaLog,
  EmpleadoDocumentoAdjunto,
  PersonalFilterParams,
} from "@/types/empleado";

export interface SupervisorOption {
  id: number;
  nombre: string;
  cargo?: string;
  movil?: string;
}

export const personalService = {
  /**
   * Obtiene la lista de perfiles de empleados con filtros y búsqueda.
   */
  async getEmpleados(params?: PersonalFilterParams): Promise<EmpleadoPerfilItem[]> {
    const cleanParams: Record<string, string> = {};
    if (params) {
      if (params.search) cleanParams.search = params.search;
      if (params.estado) cleanParams.estado = params.estado;
      if (params.ciudad) cleanParams.ciudad_operacion = params.ciudad;
      if (params.cargo) cleanParams.cargo = params.cargo;
      if (params.supervisor_id) cleanParams.supervisor_directo = String(params.supervisor_id);
      if (params.etapa_induccion) cleanParams.etapa_induccion = params.etapa_induccion;
      if (params.movil) cleanParams.movil = params.movil;
      if (params.ordering) cleanParams.ordering = params.ordering;
    }
    const response = await api.get<EmpleadoPerfilItem[]>("/empleados/perfiles/", {
      params: cleanParams,
    });
    return response.data;
  },

  /**
   * Obtiene la ficha 360° completa de un empleado con todos sus satélites.
   */
  async getEmpleadoDetail(id: number): Promise<EmpleadoPerfilCompleto> {
    const response = await api.get<EmpleadoPerfilCompleto>(`/empleados/perfiles/${id}/`);
    return response.data;
  },

  /**
   * Crea un nuevo empleado iniciando su ciclo de vida en EN_FORMACION.
   */
  async createEmpleado(data: Partial<EmpleadoPerfilCompleto>): Promise<EmpleadoPerfilCompleto> {
    const response = await api.post<EmpleadoPerfilCompleto>("/empleados/perfiles/", data);
    return response.data;
  },

  /**
   * Actualización completa (PUT) de la ficha 360°.
   */
  async updateEmpleado(id: number, data: Partial<EmpleadoPerfilCompleto>): Promise<EmpleadoPerfilCompleto> {
    const response = await api.put<EmpleadoPerfilCompleto>(`/empleados/perfiles/${id}/`, data);
    return response.data;
  },

  /**
   * Actualización parcial (PATCH) de la ficha 360°.
   */
  async patchEmpleado(id: number, data: Partial<EmpleadoPerfilCompleto>): Promise<EmpleadoPerfilCompleto> {
    const response = await api.patch<EmpleadoPerfilCompleto>(`/empleados/perfiles/${id}/`, data);
    return response.data;
  },

  /**
   * Transfiere el empleado de Gestión Humana a Operaciones.
   */
  async entregarGH(id: number, payload: EntregaGHPayload): Promise<EmpleadoPerfilCompleto> {
    const response = await api.post<EmpleadoPerfilCompleto>(
      `/empleados/perfiles/${id}/entregar-gh/`,
      payload
    );
    return response.data;
  },

  /**
   * Asigna placa vehicular con validación atómica de exclusividad.
   */
  async asignarPlaca(id: number, payload: AsignarPlacaPayload): Promise<any> {
    const response = await api.post(
      `/empleados/perfiles/${id}/asignar-placa/`,
      payload
    );
    return response.data;
  },

  /**
   * Desactiva un empleado con registro dual de retiro y liberación de recursos.
   */
  async desactivarEmpleado(id: number, payload: DesactivarEmpleadoPayload): Promise<EmpleadoPerfilCompleto> {
    const response = await api.post<EmpleadoPerfilCompleto>(
      `/empleados/perfiles/${id}/desactivar/`,
      payload
    );
    return response.data;
  },

  /**
   * Reactiva un empleado marcándolo como ACTIVO.
   */
  async reactivarEmpleado(id: number, payload?: ReactivarEmpleadoPayload): Promise<EmpleadoPerfilCompleto> {
    const response = await api.post<EmpleadoPerfilCompleto>(
      `/empleados/perfiles/${id}/reactivar/`,
      payload || {}
    );
    return response.data;
  },

  /**
   * Registra o actualiza una cuenta bancaria (normalizada a 12 dígitos).
   */
  /**
   * Sube un documento adjunto del colaborador (ej. CEDULA_FRONTAL, CEDULA_POSTERIOR).
   */
  async subirDocumento(
    id: number,
    tipoDocumento: string,
    file: File
  ): Promise<EmpleadoDocumentoAdjunto> {
    const formData = new FormData();
    formData.append("tipo_documento", tipoDocumento);
    formData.append("archivo", file);
    const response = await api.post<EmpleadoDocumentoAdjunto>(
      `/empleados/perfiles/${id}/subir-documento/`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  /**
   * Elimina un documento adjunto del colaborador.
   */
  async eliminarDocumento(id: number, tipoDocumento: string): Promise<{ success: boolean; msg: string }> {
    const response = await api.delete<{ success: boolean; msg: string }>(
      `/empleados/perfiles/${id}/documentos/${tipoDocumento}/`
    );
    return response.data;
  },

  /**
   * Registra o actualiza un contacto de emergencia (Red de Apoyo).
   */
  async gestionarContactoEmergencia(
    id: number,
    payload: any
  ): Promise<any> {
    const response = await api.post(
      `/empleados/perfiles/${id}/contactos-emergencia/`,
      payload
    );
    return response.data;
  },

  /**
   * Elimina un contacto de emergencia de la red de apoyo.
   */
  async eliminarContactoEmergencia(
    id: number,
    contactoId: number
  ): Promise<{ success: boolean; msg: string }> {
    const response = await api.delete<{ success: boolean; msg: string }>(
      `/empleados/perfiles/${id}/contactos-emergencia/${contactoId}/`
    );
    return response.data;
  },

  async gestionarCuentaBancaria(
    id: number,
    payload: GestionarCuentaBancariaPayload
  ): Promise<EmpleadoCuentaBancaria> {
    const response = await api.post<EmpleadoCuentaBancaria>(
      `/empleados/perfiles/${id}/cuentas-bancarias/`,
      payload
    );
    return response.data;
  },

  /**
   * Obtiene las cuentas bancarias registradas de un empleado.
   */
  async getCuentasBancarias(id: number): Promise<EmpleadoCuentaBancaria[]> {
    const response = await api.get<EmpleadoCuentaBancaria[]>(
      `/empleados/perfiles/${id}/cuentas-bancarias/`
    );
    return response.data;
  },

  /**
   * Obtiene la bitácora cronológica de auditoría de un empleado.
   */
  async getAuditoriaLog(id: number): Promise<EmpleadoAuditoriaLog[]> {
    const response = await api.get<EmpleadoAuditoriaLog[]>(
      `/empleados/perfiles/${id}/auditoria/`
    );
    return response.data;
  },

  /**
   * Lista supervisores / líderes operativos elegibles para asignación.
   */
  async getSupervisores(): Promise<SupervisorOption[]> {
    const response = await api.get<SupervisorOption[]>("/empleados/perfiles/supervisores/");
    return response.data;
  },
};
