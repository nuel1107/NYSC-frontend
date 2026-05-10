import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "corps_member" | "admin" | "lgi" | "media_editor";

interface Profile {
  id: string;
  full_name: string;
  state_code: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (r: AppRole) => boolean;
  primaryRole: AppRole | null;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExtras = async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,state_code,phone,avatar_url").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role,status").eq("user_id", uid).eq("status", "approved"),
    ]);
    setProfile(p as Profile | null);
    setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => { void loadExtras(s.user.id); }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) await loadExtras(s.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => { if (user) await loadExtras(user.id); };
  const signOut = async () => { await supabase.auth.signOut(); };

  // Priority: lgi > admin > media_editor > corps_member
  const order: AppRole[] = ["lgi", "admin", "media_editor", "corps_member"];
  const primaryRole = order.find((r) => roles.includes(r)) ?? null;

  return (
    <Ctx.Provider value={{
      session, user, profile, roles, loading, signOut, refresh,
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
    case "corps_member": return "/corps";
    default: return "/auth";
  }
}
