// src/modules/infraestructura/personal/components/PersonalTable.tsx
"use client";

import React, { useMemo, useState } from "react";
import { SortingState } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { DataTable } from "@/components/common/DataTable";
import Button from "@/components/ui/button/Button";
import { EmpleadoPerfilItem } from "@/types/empleado";
import { exportToCsv } from "@/utils/csv";
import { ModalEntregaGH } from "./ModalEntregaGH";
import { ModalAsignarPlaca } from "./ModalAsignarPlaca";
import { ModalDesactivar } from "./ModalDesactivar";
import { ModalReactivar } from "./ModalReactivar";
import {
  getPersonalColumns,
  personalCsvColumns,
  PERSONAL_TABLE_CONFIG,
} from "./personalTable.utils";

interface Props {
  items: EmpleadoPerfilItem[];
  isLoading: boolean;
  onSelectEmpleado: (id: number) => void;
  toolbarActions?: React.ReactNode;
}

export const PersonalTable: React.FC<Props> = ({
  items,
  isLoading,
  onSelectEmpleado,
  toolbarActions: customToolbarActions,
}) => {
  const [targetEmpleado, setTargetEmpleado] =
    useState<EmpleadoPerfilItem | null>(null);
  const [modalAction, setModalAction] = useState<
    "entrega" | "placa" | "desactivar" | "reactivar" | null
  >(null);

  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageIndex, setPageIndex] = useState<number>(
    PERSONAL_TABLE_CONFIG.defaultPageIndex
  );
  const [pageSize, setPageSize] = useState<number>(
    PERSONAL_TABLE_CONFIG.defaultPageSize
  );
  const [visibleRows, setVisibleRows] = useState<EmpleadoPerfilItem[]>([]);

  const openAction = (
    emp: EmpleadoPerfilItem,
    action: "entrega" | "placa" | "desactivar" | "reactivar"
  ) => {
    setTargetEmpleado(emp);
    setModalAction(action);
  };

  const closeAction = () => {
    setTargetEmpleado(null);
    setModalAction(null);
  };

  const columns = useMemo(
    () =>
      getPersonalColumns({
        onSelectEmpleado,
        openAction,
      }),
    [onSelectEmpleado]
  );

  const toolbarActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        onClick={() =>
          exportToCsv(visibleRows, {
            fileName: PERSONAL_TABLE_CONFIG.csvFileName,
            columns: personalCsvColumns,
          })
        }
        disabled={!visibleRows.length}
      >
        <Download className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <span>Exportar CSV</span>
      </Button>
      {customToolbarActions}
    </div>
  );

  return (
    <>
      <div className="w-full">
        <DataTable
          data={items}
          columns={columns}
          isLoading={isLoading}
          enablePagination
          pageSize={pageSize}
          pageSizeOptions={[...PERSONAL_TABLE_CONFIG.pageSizeOptions]}
          emptyMessage="No se encontraron colaboradores."
          enableGlobalFilter
          globalFilterPlaceholder="Buscar por cédula, nombre, cargo, móvil..."
          enableSorting
          enableColumnFilters
          enableColumnVisibility
          globalFilterValue={globalFilter}
          sortingValue={sorting}
          pageIndexValue={pageIndex}
          pageSizeValue={pageSize}
          onGlobalFilterChange={(value) => {
            setGlobalFilter(value);
            setPageIndex(0);
          }}
          onSortingChange={(nextSorting) => {
            setSorting(nextSorting);
            setPageIndex(0);
          }}
          onPageChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPageIndex(0);
          }}
          onVisibleDataChange={setVisibleRows}
          toolbarActions={toolbarActions}
        />
      </div>

      {/* Domain Action Modals */}
      {modalAction === "entrega" && targetEmpleado && (
        <ModalEntregaGH
          empleado={targetEmpleado}
          isOpen={modalAction === "entrega"}
          onClose={closeAction}
        />
      )}
      {modalAction === "placa" && targetEmpleado && (
        <ModalAsignarPlaca
          empleado={targetEmpleado}
          isOpen={modalAction === "placa"}
          onClose={closeAction}
        />
      )}
      {modalAction === "desactivar" && targetEmpleado && (
        <ModalDesactivar
          empleado={targetEmpleado}
          isOpen={modalAction === "desactivar"}
          onClose={closeAction}
        />
      )}
      {modalAction === "reactivar" && targetEmpleado && (
        <ModalReactivar
          empleado={targetEmpleado}
          isOpen={modalAction === "reactivar"}
          onClose={closeAction}
        />
      )}
    </>
  );
};
