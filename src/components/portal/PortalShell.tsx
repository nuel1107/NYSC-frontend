import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Bell, Home, QrCode, Users, Newspaper, Shield, BarChart3, UserCheck, LayoutGrid, Briefcase, Building2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

export type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

export const corpsNav: NavItem[] = [
  { to: "/corps", label: "Home", icon: Home },
  { to: "/corps/scan", label: "Scan", icon: QrCode },
  { to: "/corps/community", label: "Community", icon: Users },
  { to: "/corps/hub", label: "Hub", icon: LayoutGrid },
  { to: "/corps/news", label: "News", icon: Newspaper },
];

export const adminNav: NavItem[] = [
  { to: "/admin", label: "Overview", icon: BarChart3 },
  { to: "/admin/qr", label: "Events", icon: QrCode },
  { to: "/admin/approvals", label: "Devices", icon: Smartphone },
  { to: "/admin/community", label: "Content", icon: Users },
  { to: "/admin/news", label: "News", icon: Newspaper },
];

export const lgiNav: NavItem[] = [
  { to: "/lgi", label: "Control", icon: Shield },
  { to: "/lgi/approvals", label: "Approvals", icon: UserCheck },
  { to: "/lgi/attendance", label: "Events", icon: QrCode },
  { to: "/lgi/metrics", label: "Metrics", icon: BarChart3 },
  { to: "/lgi/audit", label: "Audit", icon: Shield },
];

export const mediaNav: NavItem[] = [
  { to: "/media", label: "Articles", icon: Newspaper },
];

export const firmNav: NavItem[] = [
  { to: "/firm", label: "Firm", icon: Building2 },
  { to: "/firm/jobs", label: "Jobs", icon: Briefcase },
];

export function PortalShell({ items, role, children }: { items: NavItem[]; role: AppRole; children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [unread, setUnread] = useState(0);
  const { user } = useAuth();
  const [pendingDevReq, setPendingDevReq] = useState<{ id: string; new_label: string | null; reason: string; new_fingerprint: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("notifications").select("id");
      const { data: reads } = await supabase.from("notification_reads").select("notification_id").eq("user_id", user.id);
      const readSet = new Set((reads ?? []).map((r) => r.notification_id));
      setUnread((data ?? []).filter((n) => !readSet.has(n.id)).length);

      const { data: req } = await supabase
        .from("device_change_requests")
        .select("id,new_label,reason,new_fingerprint")
        .eq("user_id", user.id).eq("status", "pending").eq("path", "old_device")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      setPendingDevReq(req as typeof pendingDevReq);
    };
    void load();
    const ch = supabase.channel("notif").on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, load).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user]);

  const approveOldDevice = async (approve: boolean) => {
    if (!user || !pendingDevReq) return;
    if (approve) {
      await supabase.from("user_devices").update({ is_active: false }).eq("user_id", user.id);
      await supabase.from("user_devices").insert({
        user_id: user.id,
        fingerprint: pendingDevReq.new_fingerprint,
        label: pendingDevReq.new_label,
        is_active: true,
      });
    }
    await supabase.from("device_change_requests").update({
      status: approve ? "approved" : "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", pendingDevReq.id);
    setPendingDevReq(null);
  };

  const roleLabel: Record<AppRole, string> = {
    corps_member: "Corps Member",
    admin: "Admin",
    lgi: "LGI Super-Admin",
    media_editor: "Media Editor",
    corporate_firm: "Corporate Firm",
  };

  const portalRoot = items[0].to.split("/")[1] || "";

  return (
    <div className="min-h-screen bg-gradient-subtle pb-24">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/profile" className="flex items-center gap-3 rounded-lg p-1 -m-1 hover:bg-accent">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-primary shadow-elegant">
              <Shield className="size-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{roleLabel[role]}</p>
              <p className="text-sm font-semibold leading-none">{profile?.full_name ?? "—"}</p>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <button
              aria-label="Notifications"
              onClick={() => navigate({ to: `/${portalRoot}/notifications` as never })}
              className="relative grid size-9 place-items-center rounded-lg hover:bg-accent"
            >
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-card" />
              )}
            </button>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {pendingDevReq && (
        <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/40">
          <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">Device transfer requested</p>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/70">
                A new device wants access to your account. {pendingDevReq.reason}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => approveOldDevice(false)}>Reject</Button>
              <Button size="sm" className="bg-gradient-primary" onClick={() => approveOldDevice(true)}>Approve transfer</Button>
            </div>
          </div>
        </div>
      )}

      <motion.main
        key={path}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="container mx-auto px-4 py-6"
      >
        {children}
      </motion.main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur">
        <div className="container mx-auto grid px-2 py-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
          {items.map((it) => {
            const active = path === it.to || (it.to !== "/" && path.startsWith(it.to + "/"));
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs transition-smooth ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <it.icon className={`size-5 ${active ? "scale-110" : ""}`} />
                <span className="text-[10px] font-medium">{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
