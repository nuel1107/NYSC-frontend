import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/rankings")({
  component: AdminRankings,
});

type R = { id: string; cds_group: string; rank: number; benefits: string | null; notes: string | null; period_year: number; period_month: number };

function AdminRankings() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<R[]>([]);
  const [form, setForm] = useState({ cds_group: "", rank: "1", benefits: "", notes: "" });

  const load = async () => {
    const { data } = await supabase.from("cds_rankings").select("*").eq("period_year", year).eq("period_month", month).order("rank");
    setItems((data ?? []) as R[]);
  };
  useEffect(() => { void load(); }, [year, month]);

  const add = async () => {
    if (!form.cds_group) return;
    const { error } = await supabase.from("cds_rankings").insert({
      cds_group: form.cds_group, rank: parseInt(form.rank, 10),
      benefits: form.benefits || null, notes: form.notes || null,
      period_year: year, period_month: month, updated_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    setForm({ cds_group: "", rank: "1", benefits: "", notes: "" });
    void load();
  };
  const save = async (r: R) => {
    await supabase.from("cds_rankings").update({
      cds_group: r.cds_group, rank: r.rank, benefits: r.benefits, notes: r.notes, updated_by: user?.id ?? null,
    }).eq("id", r.id);
    toast.success("Saved");
  };
  const del = async (r: R) => { if (confirm("Delete?")) { await supabase.from("cds_rankings").delete().eq("id", r.id); void load(); } };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">CDS Rankings</p>
        <h1 className="text-2xl font-semibold">Monthly leaderboard editor</h1>
      </div>

      <div className="flex gap-2">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
          {[year - 1, year, year + 1].map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("default", { month: "long" })}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Plus className="size-4" /> Add rank</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Input placeholder="CDS group" value={form.cds_group} onChange={(e) => setForm({ ...form, cds_group: e.target.value })} />
          <Input type="number" placeholder="Rank" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} />
          <Input placeholder="Benefits" value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} />
          <Input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={add}>Add</Button></div>
      </div>

      <div className="space-y-2">
        {items.map((r, i) => (
          <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-card grid gap-2 sm:grid-cols-[2fr_1fr_2fr_2fr_auto_auto] items-end">
            <Input value={r.cds_group} onChange={(e) => { const n = [...items]; n[i] = { ...r, cds_group: e.target.value }; setItems(n); }} />
            <Input type="number" value={r.rank} onChange={(e) => { const n = [...items]; n[i] = { ...r, rank: parseInt(e.target.value || "0", 10) }; setItems(n); }} />
            <Input value={r.benefits ?? ""} onChange={(e) => { const n = [...items]; n[i] = { ...r, benefits: e.target.value }; setItems(n); }} />
            <Input value={r.notes ?? ""} onChange={(e) => { const n = [...items]; n[i] = { ...r, notes: e.target.value }; setItems(n); }} />
            <Button size="sm" onClick={() => save(r)}><Save className="size-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => del(r)}><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
