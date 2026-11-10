// src/hooks/usePermissions.ts
"use client";

import { useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { PERMISOS, AppPermiso } from "@/constants/permissions";

export const usePermissions = () => {
  const user = useAuthStore((state) => state.user);

  const can = useCallback(
    (permiso: AppPermiso | string): boolean => {
      if (!user) return false;
      if (user.is_superuser) return true;
      return user.permisos?.includes(permiso) ?? false;
    },
    [user]
  );

  const canAny = useCallback(
    (permisos: (AppPermiso | string)[]): boolean => {
      return permisos.some(can);
    },
    [can]
  );

  const canAll = useCallback(
    (permisos: (AppPermiso | string)[]): boolean => {
      return permisos.every(can);
    },
    [can]
  );

  return { can, canAny, canAll, PERMISOS, user };
};

