import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/lgi/audit")({
  component: AuditLog,
});

type Row = {
  id: string; metric_id: string; changed_by: string;
  old_value: number | null; new_value: number | null; changed_at: string;
  metric?: { metric_key: string; label: string } | null;
  user?: { full_name: string } | null;
};

function AuditLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("impact_metric_changes").select("*").order("changed_at", { ascending: false }).limit(200);
      const list = (data ?? []) as Row[];
      const mIds = Array.from(new Set(list.map((r) => r.metric_id)));
      const uIds = Array.from(new Set(list.map((r) => r.changed_by)));
      const [{ data: ms }, { data: us }] = await Promise.all([
        mIds.length ? supabase.from("impact_metrics").select("id,metric_key,label").in("id", mIds) : Promise.resolve({ data: [] }),
        uIds.length ? supabase.from("profiles").select("id,full_name").in("id", uIds) : Promise.resolve({ data: [] }),
      ]);
      const mm = new Map((ms ?? []).map((m) => [m.id, m] as const));
      const um = new Map((us ?? []).map((u) => [u.id, u] as const));
      list.forEach((r) => {
        r.metric = mm.get(r.metric_id) ?? null;
        r.user = um.get(r.changed_by) ?? null;
      });
      setRows(list); setLoading(false);
    })();
  }, []);

  if (loading) return <Loader2 className="size-5 animate-spin text-primary" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Shield className="size-5 text-primary" />
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">LGI Only</p>
          <h1 className="text-2xl font-semibold">Impact audit log</h1>
        </div>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No changes recorded yet.</p>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border bg-card p-3 shadow-card flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">{r.metric?.label ?? r.metric_id}</p>
              <p className="text-xs text-muted-foreground">by {r.user?.full_name ?? "Unknown"} · {new Date(r.changed_at).toLocaleString()}</p>
            </div>
            <p className="font-mono text-xs">
              {Number(r.old_value ?? 0).toLocaleString()} → <span className="font-bold text-primary">{Number(r.new_value ?? 0).toLocaleString()}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
