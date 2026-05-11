import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Loader2, UserCheck, Smartphone, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/lgi/approvals")({
  component: LGIApprovals,
});

type RoleReq = {
  id: string;
  role: string;
  status: string;
  user_id: string;
  created_at: string;
  profile?: { full_name: string; portal_number: string | null; firm_company_name: string | null } | null;
};

type DevReq = {
  id: string;
  user_id: string;
  reason: string;
  path: "old_device" | "admin";
  status: string;
  created_at: string;
  new_label: string | null;
  profile?: { full_name: string } | null;
};

function LGIApprovals() {
  const { user, refresh } = useAuth();
  const [roles, setRoles] = useState<RoleReq[]>([]);
  const [devs, setDevs] = useState<DevReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [stepBusy, setStepBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: rs }, { data: ds }] = await Promise.all([
      supabase.from("user_roles").select("id,role,status,user_id,created_at").eq("status", "pending").order("created_at"),
      supabase.from("device_change_requests").select("id,user_id,reason,path,status,created_at,new_label").eq("status", "pending").eq("path", "admin").order("created_at"),
    ]);

    const ids = Array.from(new Set([...(rs ?? []).map((r) => r.user_id), ...(ds ?? []).map((d) => d.user_id)]));
    const profMap = new Map<string, { full_name: string; portal_number: string | null; firm_company_name: string | null }>();
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name,portal_number,firm_company_name").in("id", ids);
      (ps ?? []).forEach((p) => profMap.set(p.id, { full_name: p.full_name, portal_number: p.portal_number, firm_company_name: p.firm_company_name }));
    }

    setRoles((rs ?? []).map((r) => ({ ...r, profile: profMap.get(r.user_id) ?? null })));
    setDevs((ds ?? []).map((d) => ({
      ...d,
      path: d.path as "old_device" | "admin",
      profile: profMap.get(d.user_id) ? { full_name: profMap.get(d.user_id)!.full_name } : null,
    })));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const decideRole = async (r: RoleReq, approve: boolean) => {
    const { error } = await supabase.from("user_roles").update({ status: approve ? "approved" : "rejected" }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("notifications").insert({
      title: approve ? "Role approved" : "Role rejected",
      body: `Your ${r.role} access has been ${approve ? "approved" : "rejected"}.`,
      target_user_id: r.user_id,
    });
    toast.success(approve ? "Approved" : "Rejected");
    void load();
  };

  const decideDevice = async (d: DevReq, approve: boolean) => {
    if (approve) {
      // Deactivate any existing devices, then create the new one as active
      await supabase.from("user_devices").update({ is_active: false }).eq("user_id", d.user_id);
      const fp = (await supabase.from("device_change_requests").select("new_fingerprint,new_label").eq("id", d.id).single()).data;
      if (fp) {
        await supabase.from("user_devices").insert({
          user_id: d.user_id,
          fingerprint: fp.new_fingerprint,
          label: fp.new_label,
          is_active: true,
        });
      }
    }
    await supabase.from("device_change_requests").update({
      status: approve ? "approved" : "rejected",
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", d.id);
    await supabase.from("notifications").insert({
      title: approve ? "Device transfer approved" : "Device transfer rejected",
      body: approve ? "Sign in again on your new device." : "Contact LGA support if needed.",
      target_user_id: d.user_id,
    });
    toast.success(approve ? "Device approved" : "Device rejected");
    void load();
  };

  const stepDown = async () => {
    if (!user) return;
    if (!confirm("Step down as LGI? This will deactivate your super-admin role and free the seat.")) return;
    setStepBusy(true);
    const { error } = await supabase.from("user_roles").update({ status: "rejected" }).eq("user_id", user.id).eq("role", "lgi");
    setStepBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("You have stepped down as LGI");
    await refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">LGI Console</p>
          <h1 className="text-2xl font-semibold">Approvals</h1>
        </div>
        <Button variant="outline" size="sm" disabled={stepBusy} onClick={stepDown}>
          <ShieldOff className="mr-2 size-4" /> Step down as LGI
        </Button>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles"><UserCheck className="mr-2 size-4" /> Roles ({roles.length})</TabsTrigger>
          <TabsTrigger value="devices"><Smartphone className="mr-2 size-4" /> Device transfers ({devs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-4 space-y-3">
          {loading && <Loader2 className="size-5 animate-spin text-primary" />}
          {!loading && roles.length === 0 && <p className="text-sm text-muted-foreground">No pending role requests.</p>}
          {roles.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-card">
              <div>
                <p className="font-medium">{r.profile?.full_name ?? "Unknown"}</p>
                <p className="text-xs text-muted-foreground">
                  Requesting <span className="font-semibold capitalize">{r.role.replace("_", " ")}</span>
                  {r.profile?.portal_number ? ` · Portal #${r.profile.portal_number}` : ""}
                  {r.profile?.firm_company_name ? ` · ${r.profile.firm_company_name}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => decideRole(r, false)}><X className="size-4" /></Button>
                <Button size="sm" className="bg-gradient-primary" onClick={() => decideRole(r, true)}><Check className="size-4" /></Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="devices" className="mt-4 space-y-3">
          {loading && <Loader2 className="size-5 animate-spin text-primary" />}
          {!loading && devs.length === 0 && <p className="text-sm text-muted-foreground">No pending device transfers.</p>}
          {devs.map((d) => (
            <div key={d.id} className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{d.profile?.full_name ?? "Unknown"}</p>
                  <p className="mt-1 text-sm">{d.reason}</p>
                  {d.new_label && <p className="mt-1 truncate text-xs text-muted-foreground">{d.new_label}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => decideDevice(d, false)}><X className="size-4" /></Button>
                  <Button size="sm" className="bg-gradient-primary" onClick={() => decideDevice(d, true)}><Check className="size-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
