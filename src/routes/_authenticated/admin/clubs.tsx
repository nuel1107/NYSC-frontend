import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, Users2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/clubs")({
  component: AdminClubs,
});

type Club = { id: string; name: string; description: string | null; category: string | null; cover_url: string | null; is_active: boolean };
type Mem = { id: string; user_id: string; club_id: string; status: string; user?: { full_name: string } | null };

function AdminClubs() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [members, setMembers] = useState<Mem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ name: "", category: "", description: "" });

  const load = async () => {
    const { data: cs } = await supabase.from("clubs").select("*").order("name");
    setClubs((cs ?? []) as Club[]);
    const { data: ms } = await supabase.from("club_memberships").select("*").order("joined_at", { ascending: false });
    const list = (ms ?? []) as Mem[];
    const ids = Array.from(new Set(list.map((m) => m.user_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const map = new Map((ps ?? []).map((p) => [p.id, { full_name: p.full_name }] as const));
      list.forEach((m) => { m.user = map.get(m.user_id) ?? null; });
    }
    setMembers(list);
    const c: Record<string, number> = {};
    list.filter((m) => m.status === "approved").forEach((m) => { c[m.club_id] = (c[m.club_id] ?? 0) + 1; });
    setCounts(c);
  };
  useEffect(() => { void load(); }, []);

  const addClub = async () => {
    if (!form.name) return;
    const { error } = await supabase.from("clubs").insert(form);
    if (error) { toast.error(error.message); return; }
    setForm({ name: "", category: "", description: "" });
    void load();
  };
  const saveClub = async (c: Club) => {
    await supabase.from("clubs").update({ name: c.name, category: c.category, description: c.description, is_active: c.is_active }).eq("id", c.id);
    toast.success("Saved");
  };
  const delClub = async (c: Club) => { if (confirm("Delete club?")) { await supabase.from("clubs").delete().eq("id", c.id); void load(); } };

  const decide = async (m: Mem, status: string) => {
    await supabase.from("club_memberships").update({ status }).eq("id", m.id);
    void load();
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Clubs</p>
        <h1 className="text-2xl font-semibold">Manage clubs & members</h1>
      </div>

      <Tabs defaultValue="clubs">
        <TabsList>
          <TabsTrigger value="clubs">Clubs ({clubs.length})</TabsTrigger>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="clubs" className="mt-4 space-y-3">
          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Plus className="size-4" /> New club</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input placeholder="Name (e.g. Mental Health)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="mt-3 flex justify-end"><Button onClick={addClub}>Add</Button></div>
          </div>
          {clubs.map((c, i) => (
            <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr_3fr_auto_auto_auto] items-end">
                <Input value={c.name} onChange={(e) => { const n = [...clubs]; n[i] = { ...c, name: e.target.value }; setClubs(n); }} />
                <Input value={c.category ?? ""} onChange={(e) => { const n = [...clubs]; n[i] = { ...c, category: e.target.value }; setClubs(n); }} />
                <Textarea rows={1} value={c.description ?? ""} onChange={(e) => { const n = [...clubs]; n[i] = { ...c, description: e.target.value }; setClubs(n); }} />
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users2 className="size-4" /> {counts[c.id] ?? 0}</div>
                <Button size="sm" onClick={() => saveClub(c)}><Save className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => delClub(c)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="members" className="mt-4 space-y-2">
          {members.map((m) => {
            const club = clubs.find((c) => c.id === m.club_id);
            return (
              <div key={m.id} className="flex items-center justify-between rounded-2xl border bg-card p-3 shadow-card">
                <div>
                  <p className="text-sm font-medium">{m.user?.full_name ?? "?"} → {club?.name ?? "Club"}</p>
                  <p className="text-xs text-muted-foreground">{m.status}</p>
                </div>
                {m.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => decide(m, "rejected")}><X className="size-4" /></Button>
                    <Button size="sm" className="bg-gradient-primary" onClick={() => decide(m, "approved")}><Check className="size-4" /></Button>
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
