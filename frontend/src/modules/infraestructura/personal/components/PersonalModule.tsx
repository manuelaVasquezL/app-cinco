// src/modules/infraestructura/personal/components/PersonalModule.tsx
"use client";

import React, { useEffect, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { usePersonalStore } from "../store/usePersonalStore";
import { PersonalStats } from "./PersonalStats";
import { PersonalFiltersBar } from "./PersonalFiltersBar";
import { PersonalTable } from "./PersonalTable";
import { PersonalDetailModal } from "./PersonalDetailModal";
import { ModalCrearEmpleado } from "./ModalCrearEmpleado";

export const PersonalModule: React.FC = () => {
  const {
    items,
    isLoading,
    fetchEmpleados,
    selectedEmpleado,
    fetchEmpleadoDetail,
    clearSelected,
  } = usePersonalStore();

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCrearOpen, setIsCrearOpen] = useState(false);

  useEffect(() => {
    fetchEmpleados();
  }, [fetchEmpleados]);

  const handleSelectEmpleado = async (id: number) => {
    await fetchEmpleadoDetail(id);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    clearSelected();
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Header */}
      <PageBreadcrumb pageTitle={["Infraestructura", "Infraestructura General"]} />

      {/* Summary KPI Cards */}
      <PersonalStats items={items} />

      {/* Filters and Search Bar */}
      <PersonalFiltersBar onOpenNuevoEmpleado={() => setIsCrearOpen(true)} />

      {/* Main Personal Table */}
      <PersonalTable
        items={items}
        isLoading={isLoading}
        onSelectEmpleado={handleSelectEmpleado}
      />

      {/* 360° Employee Detail Modal */}
      {isDetailOpen && (
        <PersonalDetailModal
          empleado={selectedEmpleado}
          isOpen={isDetailOpen}
          onClose={handleCloseDetail}
          onRefresh={() => {
            if (selectedEmpleado) {
              fetchEmpleadoDetail(selectedEmpleado.id);
            }
          }}
        />
      )}

      {/* New Employee Wizard Modal */}
      {isCrearOpen && (
        <ModalCrearEmpleado
          isOpen={isCrearOpen}
          onClose={() => setIsCrearOpen(false)}
        />
      )}
    </div>
  );
};
