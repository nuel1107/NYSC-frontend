import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/lgi/metrics")({
  component: LGIMetrics,
});

type M = { id: string; metric_key: string; label: string; value: number; unit: string | null; display_order: number };

function LGIMetrics() {
  const [items, setItems] = useState<M[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ metric_key: "", label: "", value: "0", unit: "", display_order: "0" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("impact_metrics").select("*").order("display_order");
    setItems((data ?? []) as M[]); setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const save = async (m: M) => {
    const { error } = await supabase.from("impact_metrics").update({
      label: m.label, value: m.value, unit: m.unit, display_order: m.display_order,
    }).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
  };
  const add = async () => {
    if (!form.metric_key || !form.label) return;
    const { error } = await supabase.from("impact_metrics").insert({
      metric_key: form.metric_key, label: form.label,
      value: parseFloat(form.value || "0"), unit: form.unit || null,
      display_order: parseInt(form.display_order || "0", 10),
    });
    if (error) { toast.error(error.message); return; }
    setForm({ metric_key: "", label: "", value: "0", unit: "", display_order: "0" });
    void load();
  };
  const del = async (m: M) => { if (confirm("Delete?")) { await supabase.from("impact_metrics").delete().eq("id", m.id); void load(); } };

  if (loading) return <Loader2 className="size-5 animate-spin text-primary" />;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">LGI Console</p>
        <h1 className="text-2xl font-semibold">Impact metrics</h1>
        <p className="text-sm text-muted-foreground">Every change is logged in the LGI-only audit trail.</p>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card grid gap-3 sm:grid-cols-5">
        <div><Label className="text-xs">Key</Label><Input value={form.metric_key} onChange={(e) => setForm({ ...form, metric_key: e.target.value })} /></div>
        <div><Label className="text-xs">Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
        <div><Label className="text-xs">Value</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
        <div><Label className="text-xs">Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
        <Button className="self-end bg-gradient-primary" onClick={add}><Plus className="mr-1 size-4" /> Add</Button>
      </div>

      {items.map((m, i) => (
        <div key={m.id} className="rounded-2xl border bg-card p-4 shadow-card grid gap-2 sm:grid-cols-[1fr_2fr_1fr_1fr_auto_auto] items-end">
          <Input disabled value={m.metric_key} />
          <Input value={m.label} onChange={(e) => { const n = [...items]; n[i] = { ...m, label: e.target.value }; setItems(n); }} />
          <Input type="number" value={m.value} onChange={(e) => { const n = [...items]; n[i] = { ...m, value: parseFloat(e.target.value || "0") }; setItems(n); }} />
          <Input value={m.unit ?? ""} onChange={(e) => { const n = [...items]; n[i] = { ...m, unit: e.target.value }; setItems(n); }} />
          <Button size="sm" onClick={() => save(m)}><Save className="size-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => del(m)}><Trash2 className="size-4" /></Button>
        </div>
      ))}
    </div>
  );
}
