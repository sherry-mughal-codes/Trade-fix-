"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type PermissionContext = {
  isAuthenticated: boolean;
  userId: string | null;
  isSuperadmin: boolean;
  permissions: string[];
  activeOrganizationId: string | null;
  activeOrganizationName: string | null;
  enabledModules: string[];
};

const RBAC_DISABLED = process.env.NEXT_PUBLIC_RBAC_DISABLED === "true";

let cached: PermissionContext | null = null;
let inflight: Promise<PermissionContext> | null = null;

async function fetchPermissions(force = false): Promise<PermissionContext> {
  if (!force && cached) return cached;
  if (inflight) return inflight;
  inflight = fetch("/api/me/permissions", { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => {
      cached = d;
      inflight = null;
      return d;
    })
    .catch(() => {
      inflight = null;
      return {
        isAuthenticated: false,
        userId: null,
        isSuperadmin: false,
        permissions: [],
        activeOrganizationId: null,
        activeOrganizationName: null,
        enabledModules: [],
      };
    });
  return inflight;
}

export function usePermissions() {
  const pathname = usePathname();
  const [ctx, setCtx] = useState<PermissionContext>(() =>
    cached || {
      isAuthenticated: false,
      userId: null,
      isSuperadmin: false,
      permissions: [],
      activeOrganizationId: null,
      activeOrganizationName: null,
      enabledModules: [],
    }
  );
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let cancelled = false;

    if (RBAC_DISABLED) {
      setCtx({
        isAuthenticated: true,
        userId: null,
        isSuperadmin: true,
        permissions: [],
        activeOrganizationId: null,
        activeOrganizationName: null,
        enabledModules: [],
      });
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (cached) {
      setCtx(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchPermissions(true).then((data) => {
      if (cancelled) return;
      setCtx(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const has = (key: string) => RBAC_DISABLED || ctx.permissions.includes(key);
  const hasModule = (moduleKey: string) => RBAC_DISABLED || ctx.enabledModules.includes(moduleKey);

  return { ...ctx, loading: RBAC_DISABLED ? false : loading, has, hasModule };
}

export function clearPermissionsCache() {
  cached = null;
  inflight = null;
}
