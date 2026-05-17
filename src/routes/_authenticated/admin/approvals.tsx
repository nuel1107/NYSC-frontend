import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  component: AdminApprovals,
});

type DevReq = {
  id: string;
  user_id: string;
  reason: string;
  status: string;
  created_at: string;
  new_label: string | null;
  new_fingerprint: string;
  profile?: { full_name: string; portal_number: string | null } | null;
};

function AdminApprovals() {
  const { user } = useAuth();
  const [devs, setDevs] = useState<DevReq[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: ds } = await supabase
      .from("device_change_requests")
      .select("id,user_id,reason,status,created_at,new_label,new_fingerprint")
      .eq("status", "pending")
      .eq("path", "admin")
      .order("created_at");
    const ids = Array.from(new Set((ds ?? []).map((d) => d.user_id)));
    const profMap = new Map<string, { full_name: string; portal_number: string | null }>();
    if (ids.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id,full_name,portal_number")
        .in("id", ids);
      (ps ?? []).forEach((p) =>
        profMap.set(p.id, { full_name: p.full_name, portal_number: p.portal_number }),
      );
    }
    setDevs((ds ?? []).map((d) => ({ ...d, profile: profMap.get(d.user_id) ?? null })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const decideDevice = async (d: DevReq, approve: boolean) => {
    if (approve) {
      await supabase.from("user_devices").update({ is_active: false }).eq("user_id", d.user_id);
      await supabase.from("user_devices").insert({
        user_id: d.user_id,
        fingerprint: d.new_fingerprint,
        label: d.new_label,
        is_active: true,
      });
    }
    await supabase
      .from("device_change_requests")
      .update({
        status: approve ? "approved" : "rejected",
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", d.id);
    await supabase.from("notifications").insert({
      title: approve ? "Device transfer approved" : "Device transfer rejected",
      body: approve ? "Sign in again on your new device." : "Contact LGA support if needed.",
      target_user_id: d.user_id,
    });
    toast.success(approve ? "Device approved" : "Device rejected");
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin Console</p>
        <h1 className="text-2xl font-semibold">Device Transfer Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Stolen / lost phone recovery requests from corps members and staff.
        </p>
      </div>

      <div className="space-y-3">
        {loading && <Loader2 className="size-5 animate-spin text-primary" />}
        {!loading && devs.length === 0 && (
          <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-card">
            <Smartphone className="mx-auto mb-2 size-6 opacity-60" />
            No pending device transfer requests.
          </div>
        )}
        {devs.map((d) => (
          <div key={d.id} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {d.profile?.full_name ?? "Unknown"}
                  {d.profile?.portal_number ? ` · Portal #${d.profile.portal_number}` : ""}
                </p>
                <p className="mt-1 text-sm">{d.reason}</p>
                {d.new_label && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{d.new_label}</p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(d.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => decideDevice(d, false)}>
                  <X className="size-4" />
                </Button>
                <Button
                  size="sm"
                  className="bg-gradient-primary"
                  onClick={() => decideDevice(d, true)}
                >
                  <Check className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
