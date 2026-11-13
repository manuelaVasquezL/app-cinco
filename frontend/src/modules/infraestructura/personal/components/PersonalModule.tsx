// src/modules/infraestructura/personal/components/PersonalModule.tsx
"use client";

import React, { useEffect, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Users, FileSpreadsheet, Building } from "lucide-react";
import { usePersonalStore } from "../store/usePersonalStore";
import { PersonalStats } from "./PersonalStats";
import { PersonalFiltersBar } from "./PersonalFiltersBar";
import { PersonalTable } from "./PersonalTable";
import { PersonalDetailModal, PersonalDetailTabKey } from "./PersonalDetailModal";
import { ModalCrearEmpleado } from "./ModalCrearEmpleado";
import { ModalAlertasPeriodoPrueba } from "./ModalAlertasPeriodoPrueba";
import { ModalAlertasPracticas } from "./ModalAlertasPracticas";
import { TablaSIIGO } from "./TablaSIIGO";
import { TablaSSFF } from "./TablaSSFF";

export type PersonalModuleTab = "personal" | "siigo" | "ssff";

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
    soloPracticas,
    setSoloPracticas,
  } = usePersonalStore();

  const [activeTab, setActiveTab] = useState<PersonalModuleTab>("personal");
  const [isAlertasOpen, setIsAlertasOpen] = useState(false);
  const [isPracticasOpen, setIsPracticasOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailInitialTab, setDetailInitialTab] = useState<PersonalDetailTabKey>("laboral");
  const [isCrearOpen, setIsCrearOpen] = useState(false);

  useEffect(() => {
    fetchEmpleados();
    fetchEstadisticas();
  }, [fetchEmpleados, fetchEstadisticas]);

  const handleSelectEmpleado = async (id: number, initialTab: PersonalDetailTabKey = "laboral") => {
    setDetailInitialTab(initialTab);
    await fetchEmpleadoDetail(id);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setDetailInitialTab("laboral");
    clearSelected();
  };

  const displayedItems = React.useMemo(() => {
    if (soloPracticas) {
      return [...items].sort((a, b) => (a.dias_para_fin_practica ?? 999) - (b.dias_para_fin_practica ?? 999));
    }
    if (soloPeriodoPrueba) {
      return [...items].sort((a, b) => (a.dias_para_periodo_prueba ?? 999) - (b.dias_para_periodo_prueba ?? 999));
    }
    return items;
  }, [items, soloPeriodoPrueba, soloPracticas]);

  const tabs = [
    {
      id: "personal" as PersonalModuleTab,
      label: "Personal CINCO",
      icon: Users,
    },
    {
      id: "siigo" as PersonalModuleTab,
      label: "Base SIIGO",
      icon: Building,
    },
    {
      id: "ssff" as PersonalModuleTab,
      label: "Base SSFF",
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb Header */}
      <PageBreadcrumb pageTitle={["Infraestructura", "Infraestructura General"]} />

      {/* Main Module Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 pt-2 rounded-t-xl overflow-x-auto shadow-xs">
        <nav className="flex space-x-2 min-w-max" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group inline-flex items-center gap-2 px-4 py-2.5 font-medium text-xs sm:text-sm rounded-t-lg border-b-2 transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? "border-brand-600 text-brand-700 bg-brand-50/60 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-400 font-semibold shadow-xs"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-gray-400 group-hover:text-gray-500 dark:text-gray-500"
                  }`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB 1: Personal CINCO */}
      {activeTab === "personal" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Summary KPI Cards */}
          <PersonalStats
            items={items}
            onOpenAlertas={() => setIsAlertasOpen(true)}
            onOpenPracticas={() => setIsPracticasOpen(true)}
          />

          {/* Filters and Search Bar */}
          <PersonalFiltersBar onOpenNuevoEmpleado={() => setIsCrearOpen(true)} />

          {/* Main Personal Table */}
          <PersonalTable
            items={displayedItems}
            isLoading={isLoading}
            onSelectEmpleado={handleSelectEmpleado}
          />
        </div>
      )}

      {/* TAB 2: Base SIIGO */}
      {activeTab === "siigo" && (
        <div className="animate-in fade-in duration-150">
          <TablaSIIGO onSelectEmpleado={handleSelectEmpleado} />
        </div>
      )}

      {/* TAB 3: Base SSFF (SuccessFactors) */}
      {activeTab === "ssff" && (
        <div className="animate-in fade-in duration-150">
          <TablaSSFF onSelectEmpleado={handleSelectEmpleado} />
        </div>
      )}

      {/* 360° Employee Detail Modal */}
      {isDetailOpen && (
        <PersonalDetailModal
          empleado={selectedEmpleado}
          isOpen={isDetailOpen}
          initialTab={detailInitialTab}
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

      {/* Alertas de Prácticas SENA Modal */}
      {isPracticasOpen && (
        <ModalAlertasPracticas
          isOpen={isPracticasOpen}
          onClose={() => setIsPracticasOpen(false)}
          items={items}
          onSelectEmpleado={handleSelectEmpleado}
          onFiltrarEnTabla={() => setSoloPracticas(true)}
        />
      )}
    </div>
  );
};
