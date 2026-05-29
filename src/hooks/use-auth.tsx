/**
 * use-auth.tsx
 * Replaces the Supabase-backed AuthProvider.
 * Reads/writes JWTs via tokenStore; calls our FastAPI backend.
 */
import {
  createContext, useContext, useEffect, useState, useCallback,
  type ReactNode,
} from "react";
import { api, tokenStore, ApiError } from "@/lib/api-client";
import { reconcileDevice } from "@/lib/device";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AppRole =
  | "corps_member"
  | "admin"
  | "lgi"
  | "media_editor"
  | "corporate_firm";

export interface Profile {
  id: string;
  full_name: string;
  state_code: string | null;
  phone: string | null;
  avatar_url: string | null;
  portal_number: string | null;
  firm_company_name: string | null;
  cds_group: string | null;
}

interface RoleRow {
  role: AppRole;
  status: "pending" | "approved" | "rejected";
}

interface MeResponse {
  user: {
    id: string;
    roles: RoleRow[];
    profile: Profile | null;
  };
  access_token: string;
  refresh_token: string;
}

interface AuthCtx {
  userId: string | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  deviceLocked: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (r: AppRole) => boolean;
  primaryRole: AppRole | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_ORDER: AppRole[] = [
  "lgi", "admin", "media_editor", "corporate_firm", "corps_member",
];

export function primaryRoleFromRows(rows: RoleRow[]): AppRole | null {
  const approved = rows.filter((r) => r.status === "approved").map((r) => r.role);
  return ROLE_ORDER.find((r) => approved.includes(r)) ?? null;
}

export function rolePortalPath(role: AppRole | null): string {
  switch (role) {
    case "lgi":            return "/lgi";
    case "admin":          return "/admin";
    case "media_editor":   return "/media";
    case "corporate_firm": return "/firm";
    case "corps_member":   return "/corps";
    default:               return "/auth";
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId,      setUserId]      = useState<string | null>(null);
  const [profile,     setProfile]     = useState<Profile | null>(null);
  const [roles,       setRoles]       = useState<AppRole[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [deviceLocked, setDeviceLocked] = useState(false);

  const _applyMe = useCallback(async (data: MeResponse) => {
    const { user } = data;
    setUserId(user.id);
    setProfile(user.profile ?? null);
    const approvedRoles = (user.roles ?? [])
      .filter((r) => r.status === "approved")
      .map((r) => r.role);
    setRoles(approvedRoles);

    // Device reconciliation
    try {
      const result = await reconcileDevice(user.id);
      setDeviceLocked(result.state === "locked");
    } catch (e) {
      console.error("Device reconcile failed", e);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<MeResponse>("/auth/me");
      await _applyMe(data);
    } catch {
      // Token invalid — clear state
      tokenStore.clear();
      setUserId(null);
      setProfile(null);
      setRoles([]);
    }
  }, [_applyMe]);

  // Bootstrap: restore session from stored token
  useEffect(() => {
    const token = tokenStore.getAccess();
    if (!token) {
      setLoading(false);
      return;
    }
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Listen for auth:logout events (fired by api-client on 401 after refresh fails)
  useEffect(() => {
    const handler = () => {
      setUserId(null);
      setProfile(null);
      setRoles([]);
      setDeviceLocked(false);
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  const signOut = useCallback(async () => {
    await api.post("/auth/signout").catch(() => {});
    tokenStore.clear();
    setUserId(null);
    setProfile(null);
    setRoles([]);
    setDeviceLocked(false);
  }, []);

  const primaryRole = ROLE_ORDER.find((r) => roles.includes(r)) ?? null;

  return (
    <Ctx.Provider
      value={{
        userId,
        profile,
        roles,
        loading,
        deviceLocked,
        signOut,
        refresh,
        hasRole: (r) => roles.includes(r),
        primaryRole,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ── Auth actions (used in route components) ───────────────────────────────────

export async function signIn(
  email: string,
  password: string,
): Promise<MeResponse> {
  const data = await api.post<MeResponse & { access_token: string; refresh_token: string }>(
    "/auth/signin",
    { email, password },
  );
  tokenStore.set(data.access_token, data.refresh_token);
  return data;
}

export async function signUp(payload: {
  email: string;
  password: string;
  role: AppRole;
  full_name: string;
  phone?: string;
  state_code?: string;
  batch?: string;
  stream?: string;
  cds_group?: string;
  portal_number?: string;
  firm_company_name?: string;
  num_staff?: number;
  industry?: string;
  applicant_role?: string;
  csr_focus?: string;
}): Promise<MeResponse> {
  const data = await api.post<MeResponse & { access_token: string; refresh_token: string }>(
    "/auth/signup",
    payload,
  );
  tokenStore.set(data.access_token, data.refresh_token);
  return data;
}
