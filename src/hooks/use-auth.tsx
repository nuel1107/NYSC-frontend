import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { reconcileDevice } from "@/lib/device";

export type AppRole = "corps_member" | "admin" | "lgi" | "media_editor" | "corporate_firm";

interface Profile {
  id: string;
  full_name: string;
  state_code: string | null;
  phone: string | null;
  avatar_url: string | null;
  portal_number: string | null;
  firm_company_name: string | null;
  cds_group: string | null;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  deviceLocked: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (r: AppRole) => boolean;
  primaryRole: AppRole | null;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

type PortalRoleRow = { role: AppRole; status: "pending" | "approved" | "rejected" };
const roleOrder: AppRole[] = ["lgi", "admin", "media_editor", "corporate_firm", "corps_member"];

export async function ensurePortalRecords(): Promise<PortalRoleRow[]> {
  const { data, error } = await supabase.rpc("ensure_user_portal_records");

  if (error) throw error;
  return (data ?? []) as PortalRoleRow[];
}

export function primaryRoleFromRows(rows: PortalRoleRow[]): AppRole | null {
  const approvedRoles = rows.filter((x) => x.status === "approved").map((x) => x.role);
  return roleOrder.find((r) => approvedRoles.includes(r)) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceLocked, setDeviceLocked] = useState(false);

  const loadExtras = async (uid: string) => {
    const repairedRoles = await ensurePortalRecords();
    const { data: p } = await supabase
      .from("profiles")
      .select("id,full_name,state_code,phone,avatar_url,portal_number,firm_company_name,cds_group")
      .eq("id", uid)
      .maybeSingle();

    setProfile(p as Profile | null);
    setRoles(repairedRoles.filter((x) => x.status === "approved").map((x) => x.role));

    // Device reconciliation
    try {
      const result = await reconcileDevice(uid);
      setDeviceLocked(result.state === "locked");
    } catch (e) {
      console.error("Device reconcile failed", e);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setLoading(true);
        setTimeout(() => {
          void loadExtras(s.user.id)
            .catch((error) => console.error("Portal records failed to load", error))
            .finally(() => setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setDeviceLocked(false);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await loadExtras(s.user.id).catch((error) => console.error("Portal records failed to load", error));
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => { if (user) await loadExtras(user.id); };
  const signOut = async () => { await supabase.auth.signOut(); };

  // Priority: lgi > admin > media_editor > corporate_firm > corps_member
  const primaryRole = roleOrder.find((r) => roles.includes(r)) ?? null;

  return (
    <Ctx.Provider value={{
      session, user, profile, roles, loading, deviceLocked, signOut, refresh,
      hasRole: (r) => roles.includes(r),
      primaryRole,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function rolePortalPath(role: AppRole | null): string {
  switch (role) {
    case "lgi": return "/lgi";
    case "admin": return "/admin";
    case "media_editor": return "/media";
    case "corporate_firm": return "/firm";
    case "corps_member": return "/corps";
    default: return "/auth";
  }
}
