// src/modules/infraestructura/personal/store/usePersonalStore.ts
import { create } from "zustand";
import {
  EmpleadoPerfilItem,
  EmpleadoPerfilCompleto,
  PersonalFilterParams,
  EstadoEmpleado,
} from "@/types/empleado";
import { personalService, SupervisorOption } from "../services/personalService";

interface PersonalState {
  // Lista de empleados
  items: EmpleadoPerfilItem[];
  isLoading: boolean;
  error: string | null;

  // Ficha seleccionada (Detalle 360°)
  selectedEmpleado: EmpleadoPerfilCompleto | null;
  isDetailLoading: boolean;
  detailError: string | null;

  // Catálogos auxiliares
  supervisores: SupervisorOption[];
  isLoadingSupervisores: boolean;

  // Filtros activos
  filters: PersonalFilterParams;

  // Acciones
  fetchEmpleados: () => Promise<void>;
  fetchEmpleadoDetail: (id: number) => Promise<void>;
  fetchSupervisores: () => Promise<void>;
  setFilter: <K extends keyof PersonalFilterParams>(key: K, value: PersonalFilterParams[K]) => void;
  setEstadoTab: (estado: EstadoEmpleado | 'TODOS') => void;
  resetFilters: () => void;
  clearSelected: () => void;
  updateLocalItem: (updated: EmpleadoPerfilItem | EmpleadoPerfilCompleto) => void;
}

const initialFilters: PersonalFilterParams = {
  search: "",
  estado: "ACTIVO",
  ciudad: "",
  cargo: "",
  supervisor_id: "",
  movil: "",
};

export const usePersonalStore = create<PersonalState>((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  selectedEmpleado: null,
  isDetailLoading: false,
  detailError: null,

  supervisores: [],
  isLoadingSupervisores: false,

  filters: { ...initialFilters },

  fetchEmpleados: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filters } = get();
      const cleanFilters: PersonalFilterParams = { ...filters };
      if (cleanFilters.estado === "TODOS") {
        delete cleanFilters.estado;
      }
      const data = await personalService.getEmpleados(cleanFilters);
      set({ items: data, isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cargar la base de personal";
      set({ error: msg, isLoading: false });
    }
  },

  fetchEmpleadoDetail: async (id: number) => {
    set({ isDetailLoading: true, detailError: null });
    try {
      const data = await personalService.getEmpleadoDetail(id);
      set({ selectedEmpleado: data, isDetailLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cargar la ficha del empleado";
      set({ detailError: msg, isDetailLoading: false });
    }
  },

  fetchSupervisores: async () => {
    set({ isLoadingSupervisores: true });
    try {
      const sups = await personalService.getSupervisores();
      set({ supervisores: sups, isLoadingSupervisores: false });
    } catch {
      set({ isLoadingSupervisores: false });
    }
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value,
      },
    }));
  },

  setEstadoTab: (estado) => {
    set((state) => ({
      filters: {
        ...state.filters,
        estado: estado === "TODOS" ? undefined : estado,
      },
    }));
    get().fetchEmpleados();
  },

  resetFilters: () => {
    set({ filters: { ...initialFilters } });
    get().fetchEmpleados();
  },

  clearSelected: () => {
    set({ selectedEmpleado: null, detailError: null });
  },

  updateLocalItem: (updated) => {
    set((state) => {
      const items = state.items.map((item) => {
        if (item.id === updated.id) {
          return {
            ...item,
            ...updated,
            nombre_completo: updated.nombre_completo || item.nombre_completo,
            estado: updated.estado || item.estado,
            cargo: 'laboral' in updated ? updated.laboral?.cargo || item.cargo : item.cargo,
            movil: 'laboral' in updated ? updated.laboral?.movil || item.movil : item.movil,
          };
        }
        return item;
      });

      const selected =
        state.selectedEmpleado && state.selectedEmpleado.id === updated.id
          ? { ...state.selectedEmpleado, ...updated }
          : state.selectedEmpleado;

      return { items, selectedEmpleado: selected as EmpleadoPerfilCompleto | null };
    });
  },
}));
