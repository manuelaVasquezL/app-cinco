// src/modules/infraestructura/personal/components/TablaSIIGO.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  UploadCloud,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  AlertCircle,
  DollarSign,
  Building2,
} from "lucide-react";
import { DataTable } from "@/components/common/DataTable";
import Button from "@/components/ui/button/Button";
import { EmpleadoSIIGOItem } from "@/types/empleado";
import { personalService } from "../services/personalService";
import { ModalImportarConciliacion } from "./ModalImportarConciliacion";
import { exportToCsv, CsvColumn } from "@/utils/csv";

interface TablaSIIGOProps {
  onSelectEmpleado?: (id: number) => void;
}

export const TablaSIIGO: React.FC<TablaSIIGOProps> = ({ onSelectEmpleado }) => {
  const [data, setData] = useState<EmpleadoSIIGOItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Filters & Pagination
  const [filtroEstado, setFiltroEstado] = useState<string>("ACTIVO");
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [visibleRows, setVisibleRows] = useState<EmpleadoSIIGOItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await personalService.getPersonalSIIGO();
      const items = Array.isArray(res) ? res : (res as any)?.results || [];
      setData(items);
    } catch (err) {
      console.error("Error cargando base SIIGO:", err);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Counts by status
  const counts = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    const total = safeData.length;
    const activos = safeData.filter((d) => d.estado?.toUpperCase() === "ACTIVO").length;
    const inactivos = safeData.filter((d) => d.estado?.toUpperCase() === "INACTIVO").length;
    return { total, activos, inactivos };
  }, [data]);

  // Filtered by selected status
  const filteredData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    if (filtroEstado === "TODOS") return safeData;
    return safeData.filter((item) => item.estado?.toUpperCase() === filtroEstado);
  }, [data, filtroEstado]);

  const formatMoneda = (val?: string | null) => {
    if (!val) return "-";
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Columns definition
  const columns = useMemo<ColumnDef<EmpleadoSIIGOItem>[]>(
    () => [
      {
        accessorKey: "cedula",
        header: "Cédula / NIT",
        cell: ({ getValue }) => (
          <span className="font-mono font-medium text-xs text-gray-900 dark:text-gray-100">
            {String(getValue() || "-")}
          </span>
        ),
      },
      {
        accessorKey: "nombre_empleado",
        header: "Colaborador SIIGO",
        cell: ({ row }) => {
          const item = row.original;
          const initials = (item.nombre_empleado || "SG")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0])
            .join("")
            .toUpperCase();

          return (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                {initials}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {item.nombre_empleado || "Sin Nombre"}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Nómina SIIGO
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "centro_costo",
        header: "Centro de Costos",
        cell: ({ getValue }) => {
          const cc = getValue() as string;
          return cc ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              <Building2 className="w-3 h-3 text-slate-500" />
              {cc}
            </span>
          ) : (
            <span className="text-gray-400 text-xs italic">No especificado</span>
          );
        },
      },
      {
        accessorKey: "salario",
        header: "Sueldo / Salario",
        cell: ({ getValue }) => {
          const sal = getValue() as string;
          return (
            <span className="inline-flex items-center font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
              {formatMoneda(sal)}
            </span>
          );
        },
      },
      {
        accessorKey: "estado",
        header: "Estado en SIIGO",
        cell: ({ getValue }) => {
          const estado = String(getValue() || "").toUpperCase();
          if (estado === "ACTIVO") {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300">
                <CheckCircle2 className="w-3 h-3" />
                Activo
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <AlertCircle className="w-3 h-3" />
              Inactivo
            </span>
          );
        },
      },
            {
        accessorKey: "vinculado_en_personal",
        header: "Estado en CINCO",
        cell: ({ row }) => {
          const item = row.original;
          return item.vinculado_en_personal ? (
            <div>
              <button
                type="button"
                onClick={() => item.empleado_id && onSelectEmpleado?.(item.empleado_id)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40 ${
                  item.empleado_id && onSelectEmpleado
                    ? "hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer transition-colors"
                    : ""
                }`}
                title={item.empleado_id ? "Ver ficha 360° del colaborador en CINCO" : "Vinculado"}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Vinculado</span>
              </button>
              {item.cargo_en_personal && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[140px]">
                  {item.cargo_en_personal}
                </p>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700">
              No Registrado
            </span>
          );
        },
      },
            {
        accessorKey: "updated_at",
        header: "Última Actualización",
        cell: ({ row }) => {
          const val = row.original.updated_at || row.original.fecha_edit;
          if (!val) return <span className="text-[11px] text-gray-400 italic">No registrada</span>;
          try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
              return (
                <span className="text-[11px] text-gray-600 dark:text-gray-300 font-mono">
                  {d.toLocaleDateString("es-CO")} {d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                </span>
              );
            }
          } catch {}
          return <span className="text-[11px] text-gray-500 dark:text-gray-400">{val}</span>;
        },
      },
    ],
    [onSelectEmpleado]
  );

  const csvColumns: CsvColumn<EmpleadoSIIGOItem>[] = useMemo(
    () => [
      { header: "Cédula", accessor: (r) => r.cedula },
      { header: "Nombre Empleado", accessor: (r) => r.nombre_empleado },
      { header: "Centro de Costo", accessor: (r) => r.centro_costo || "" },
      { header: "Salario", accessor: (r) => r.salario || "" },
      { header: "Estado SIIGO", accessor: (r) => r.estado },
      {
        header: "Vinculado en CINCO",
        accessor: (r) => (r.vinculado_en_personal ? "SÍ" : "NO"),
      },
      { header: "Cargo en CINCO", accessor: (r) => r.cargo_en_personal || "" },
      {
        header: "Última Actualización",
        accessor: (r) => r.updated_at || r.fecha_edit || "",
      },
    ],
    []
  );

  const toolbarActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        onClick={() => setIsImportModalOpen(true)}
        startIcon={
          <svg
            className="h-4 w-4 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
        }
      >
        Importar CSV
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        onClick={() =>
          exportToCsv(visibleRows, {
            fileName: "Reporte_Base_SIIGO.csv",
            columns: csvColumns,
          })
        }
        disabled={!visibleRows.length}
      >
        <Download className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <span>Exportar CSV</span>
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Top Banner and Quick Status Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Base de Personal Nómina SIIGO
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Registros cargados desde el archivo de nómina de SIIGO para verificación de salarios, centros de costo y estados.
            </p>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-lg overflow-x-auto">
          <button
            onClick={() => {
              setFiltroEstado("ACTIVO");
              setPageIndex(0);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filtroEstado === "ACTIVO"
                ? "bg-brand-600 text-white font-semibold shadow-sm"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Activos ({counts.activos})
          </button>
          <button
            onClick={() => {
              setFiltroEstado("INACTIVO");
              setPageIndex(0);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filtroEstado === "INACTIVO"
                ? "bg-brand-600 text-white font-semibold shadow-sm"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Inactivos ({counts.inactivos})
          </button>
          <button
            onClick={() => {
              setFiltroEstado("TODOS");
              setPageIndex(0);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filtroEstado === "TODOS"
                ? "bg-brand-600 text-white font-semibold shadow-sm"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Todos ({counts.total})
          </button>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        data={filteredData}
        columns={columns}
        isLoading={isLoading}
        enablePagination
        pageSize={pageSize}
        pageSizeOptions={[10, 25, 50, 100]}
        emptyMessage="No se encontraron colaboradores en la base SIIGO con los filtros actuales."
        enableGlobalFilter
        globalFilterPlaceholder="Buscar por cédula, nombre, centro de costos..."
        enableSorting
        enableColumnFilters
        enableColumnVisibility
        globalFilterValue={globalFilter}
        sortingValue={sorting}
        pageIndexValue={pageIndex}
        pageSizeValue={pageSize}
        onGlobalFilterChange={(val) => {
          setGlobalFilter(val);
          setPageIndex(0);
        }}
        onSortingChange={(s) => {
          setSorting(s);
          setPageIndex(0);
        }}
        onPageChange={setPageIndex}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPageIndex(0);
        }}
        onVisibleDataChange={setVisibleRows}
        toolbarActions={toolbarActions}
      />

      {/* Modal Importar */}
      {isImportModalOpen && (
        <ModalImportarConciliacion
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          tipo="SIIGO"
          onSuccess={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
};

