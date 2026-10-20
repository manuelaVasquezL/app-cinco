// src/modules/infraestructura/personal/components/PersonalStats.tsx
"use client";

import React from "react";
import { Users, UserCheck, GraduationCap, UserX, Car } from "lucide-react";
import { EmpleadoPerfilItem } from "@/types/empleado";

interface Props {
  items: EmpleadoPerfilItem[];
}

export const PersonalStats: React.FC<Props> = ({ items }) => {
  const total = items.length;
  const activos = items.filter((i) => i.estado === "ACTIVO").length;
  const enFormacion = items.filter((i) => i.estado === "EN_FORMACION").length;
  const inactivos = items.filter((i) => i.estado === "INACTIVO").length;
  const conVehiculo = items.filter((i) => Boolean(i.placa_vehiculo)).length;

  const stats = [
    {
      label: "Total Colaboradores",
      value: total,
      icon: <Users className="h-5 w-5 text-brand-600 dark:text-brand-400" />,
      bg: "bg-brand-50 dark:bg-brand-500/10",
    },
    {
      label: "Activos en Operación",
      value: activos,
      sub: total > 0 ? `${Math.round((activos / total) * 100)}% de la nómina` : undefined,
      icon: <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
      label: "En Formación (GH)",
      value: enFormacion,
      sub: "Pendientes por entrega",
      icon: <GraduationCap className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      bg: "bg-amber-50 dark:bg-amber-500/10",
    },
    {
      label: "Flota Asignada",
      value: conVehiculo,
      sub: "Con placa vehicular",
      icon: <Car className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      bg: "bg-indigo-50 dark:bg-indigo-500/10",
    },
    {
      label: "Inactivos / Retirados",
      value: inactivos,
      sub: "Histórico de egresos",
      icon: <UserX className="h-5 w-5 text-gray-600 dark:text-gray-400" />,
      bg: "bg-gray-100 dark:bg-gray-800",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{s.label}</p>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{s.value}</h3>
              {s.sub && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{s.sub}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
