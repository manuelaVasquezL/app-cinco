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
import { ModalAlertasPeriodoPrueba } from "./ModalAlertasPeriodoPrueba";

export const PersonalModule: React.FC = () => {
  const {
    items,
    isLoading,
    fetchEmpleados,
    fetchEstadisticas,
    selectedEmpleado,
    fetchEmpleadoDetail,
    clearSelected,
    soloPeriodoPrueba,
    setSoloPeriodoPrueba,
  } = usePersonalStore();

  const [isAlertasOpen, setIsAlertasOpen] = useState(false);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCrearOpen, setIsCrearOpen] = useState(false);

  useEffect(() => {
    fetchEmpleados();
    fetchEstadisticas();
  }, [fetchEmpleados, fetchEstadisticas]);

  const handleSelectEmpleado = async (id: number) => {
    await fetchEmpleadoDetail(id);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    clearSelected();
  };

  const displayedItems = React.useMemo(() => {
    if (!soloPeriodoPrueba) return items;
    return [...items].sort((a, b) => (a.dias_para_periodo_prueba ?? 999) - (b.dias_para_periodo_prueba ?? 999));
  }, [items, soloPeriodoPrueba]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb Header */}
      <PageBreadcrumb pageTitle={["Infraestructura", "Infraestructura General"]} />

      {/* Summary KPI Cards */}
      <PersonalStats
        items={items}
        onOpenAlertas={() => setIsAlertasOpen(true)}
        onFiltrarPrueba={() => setSoloPeriodoPrueba(true)}
      />

      {/* Filters and Search Bar */}
      <PersonalFiltersBar onOpenNuevoEmpleado={() => setIsCrearOpen(true)} />

      {/* Main Personal Table */}
      <PersonalTable
        items={displayedItems}
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

      {/* Alertas de Período de Prueba Modal */}
      {isAlertasOpen && (
        <ModalAlertasPeriodoPrueba
          isOpen={isAlertasOpen}
          onClose={() => setIsAlertasOpen(false)}
          items={items}
          onSelectEmpleado={handleSelectEmpleado}
          onFiltrarEnTabla={() => setSoloPeriodoPrueba(true)}
        />
      )}
    </div>
  );
};
