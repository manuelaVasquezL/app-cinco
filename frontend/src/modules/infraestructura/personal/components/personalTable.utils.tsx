// src/modules/infraestructura/personal/components/personalTable.utils.tsx
import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Eye,
  SendHorizontal,
  Car,
  UserMinus,
  UserCheck,
  Clock,
} from "lucide-react";
import { EmpleadoPerfilItem } from "@/types/empleado";
import { CsvColumn } from "@/utils/csv";

export const getInitials = (nombre: string) => {
  const parts = nombre.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.[0] || "U").toUpperCase();
};

export const personalCsvColumns: CsvColumn<EmpleadoPerfilItem>[] = [
  { header: "ID", accessor: (row) => row.id },
  { header: "Tipo Documento", accessor: (row) => row.tipo_documento },
  { header: "Documento", accessor: (row) => row.numero_documento },
  { header: "Colaborador", accessor: (row) => row.nombre_completo },
  { header: "Cargo", accessor: (row) => row.cargo || "" },
  {
    header: "Sede / Ciudad",
    accessor: (row) => row.sede || row.ciudad_operacion || "",
  },
  { header: "Estado", accessor: (row) => row.estado },
  { header: "Etapa Inducción", accessor: (row) => row.etapa_induccion || "" },
  {
    header: "Período de Prueba",
    accessor: (row) => (row.en_periodo_prueba ? "SÍ" : "NO"),
  },
  { header: "Móvil", accessor: (row) => row.movil || "" },
  { header: "Placa", accessor: (row) => row.placa_vehiculo || "" },
  { header: "Días en Empresa", accessor: (row) => row.dias_en_empresa },
  { header: "Fecha Ingreso", accessor: (row) => row.fecha_ingreso || "" },
];

export const PERSONAL_TABLE_CONFIG = {
  defaultPageSize: 10,
  defaultPageIndex: 0,
  pageSizeOptions: [5, 10, 25, 50, 100],
  csvFileName: "personal_export.csv",
} as const;

interface ColumnProps {
  onSelectEmpleado: (id: number) => void;
  openAction: (
    emp: EmpleadoPerfilItem,
    action: "entrega" | "placa" | "desactivar" | "reactivar"
  ) => void;
}

export const getPersonalColumns = ({
  onSelectEmpleado,
  openAction,
}: ColumnProps): ColumnDef<EmpleadoPerfilItem>[] => [
  {
    id: "acciones",
    header: "ACCIONES",
    enableSorting: false,
    enableColumnFilter: false,
    enableHiding: false,
    cell: ({ row }) => {
      const emp = row.original;
      return (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSelectEmpleado(emp.id)}
            title="Ver Ficha 360°"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400"
          >
            <Eye className="h-4 w-4" />
          </button>

          {emp.etapa_induccion !== "ENTREGADO" &&
            emp.estado !== "INACTIVO" && (
              <button
                onClick={() => openAction(emp, "entrega")}
                title="Entrega de Personal (GH a Operaciones)"
                className="rounded-lg p-1.5 text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/15"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            )}

          <button
            onClick={() => openAction(emp, "placa")}
            title="Asignar Placa Vehicular"
            className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/15"
          >
            <Car className="h-4 w-4" />
          </button>

          {emp.estado === "ACTIVO" || emp.estado === "EN_FORMACION" ? (
            <button
              onClick={() => openAction(emp, "desactivar")}
              title="Desactivar / Retirar Colaborador"
              className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/15"
            >
              <UserMinus className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => openAction(emp, "reactivar")}
              title="Reactivar Colaborador"
              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
            >
              <UserCheck className="h-4 w-4" />
            </button>
          )}
        </div>
      );
    },
  },
  {
    id: "colaborador",
    header: "COLABORADOR",
    accessorFn: (row) => row.nombre_completo,
    filterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      const nombre = (row.original.nombre_completo || "").toLowerCase();
      const doc = (row.original.numero_documento || "").toLowerCase();
      const tipo = (row.original.tipo_documento || "").toLowerCase();
      return (
        nombre.includes(search) ||
        doc.includes(search) ||
        tipo.includes(search)
      );
    },
    cell: ({ row }) => {
      const emp = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-xs font-bold text-white shadow-xs overflow-hidden">
            {emp.foto_url || emp.foto_perfil_url ? (
              <img
                src={(emp.foto_url || emp.foto_perfil_url) || undefined}
                alt={emp.nombre_completo}
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              getInitials(emp.nombre_completo)
            )}
          </div>
          <div>
            <button
              onClick={() => onSelectEmpleado(emp.id)}
              className="font-bold text-gray-900 hover:text-brand-600 hover:underline dark:text-white dark:hover:text-brand-400 text-left"
            >
              {emp.nombre_completo}
            </button>
            <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
              {emp.tipo_documento} {emp.numero_documento}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    id: "cargo",
    header: "CARGO / CIUDAD",
    accessorKey: "cargo",
    filterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      const cargo = (row.original.cargo || "").toLowerCase();
      const ciudad = (
        row.original.sede ||
        row.original.ciudad_operacion ||
        ""
      ).toLowerCase();
      return cargo.includes(search) || ciudad.includes(search);
    },
    cell: ({ row }) => {
      const emp = row.original;
      return (
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-200">
            {emp.cargo || "Sin cargo"}
          </p>
          <p className="text-[11px] text-gray-400">
            {emp.sede || emp.ciudad_operacion || "Sin ciudad"}
          </p>
        </div>
      );
    },
  },
  {
    id: "estado",
    header: "ESTADO / INDUCCIÓN",
    accessorKey: "estado",
    filterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      const estado = (row.original.estado || "").toLowerCase();
      const prueba = row.original.en_periodo_prueba
        ? "período de prueba periodo prueba"
        : "";
      const induccion = (row.original.etapa_induccion || "").toLowerCase();
      return (
        estado.includes(search) ||
        prueba.includes(search) ||
        induccion.includes(search)
      );
    },
    cell: ({ row }) => {
      const emp = row.original;
      return (
        <div className="flex flex-col gap-1 items-start">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              emp.estado === "ACTIVO"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                : emp.estado === "EN_FORMACION"
                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {emp.estado}
          </span>
          {emp.en_periodo_prueba && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:bg-orange-500/15 dark:text-orange-400">
              <Clock className="h-2.5 w-2.5" />
              Período de Prueba
            </span>
          )}
        </div>
      );
    },
  },
  {
    id: "movil_placa",
    header: "MÓVIL / PLACA",
    accessorKey: "movil",
    filterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      const movil = (row.original.movil || "").toLowerCase();
      const placa = (row.original.placa_vehiculo || "").toLowerCase();
      return movil.includes(search) || placa.includes(search);
    },
    cell: ({ row }) => {
      const emp = row.original;
      return (
        <div className="space-y-0.5">
          <p className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
            {emp.movil || "Sin móvil"}
          </p>
          {emp.placa_vehiculo ? (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-600 dark:text-amber-400">
              <Car className="h-3 w-3" />
              {emp.placa_vehiculo}
            </span>
          ) : (
            <span className="text-[11px] text-gray-400">Sin vehículo</span>
          )}
        </div>
      );
    },
  },
  {
    id: "antiguedad",
    header: "ANTIGÜEDAD",
    accessorKey: "dias_en_empresa",
    filterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      const dias = String(row.original.dias_en_empresa);
      const fecha = (row.original.fecha_ingreso || "").toLowerCase();
      return dias.includes(search) || fecha.includes(search);
    },
    cell: ({ row }) => {
      const emp = row.original;
      return (
        <div>
          <p className="text-gray-700 dark:text-gray-300 font-medium">
            {emp.dias_en_empresa} días
          </p>
          <p className="text-[11px] text-gray-400">
            Desde: {emp.fecha_ingreso || "N/A"}
          </p>
        </div>
      );
    },
  },
];
