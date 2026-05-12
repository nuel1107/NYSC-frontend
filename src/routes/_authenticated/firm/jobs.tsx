import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/firm/jobs")({
  component: FirmJobs,
});

type Job = { id: string; title: string; description: string; job_type: string; location: string | null; is_active: boolean };

function FirmJobs() {
  const { user } = useAuth();
  const [firmId, setFirmId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", description: "", job_type: "full_time", location: "" });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: f } = await supabase.from("corporate_firms").select("id").eq("owner_id", user.id).maybeSingle();
    if (!f) { setLoading(false); return; }
    setFirmId(f.id);
    const { data: js } = await supabase.from("job_postings").select("*").eq("firm_id", f.id).order("created_at", { ascending: false });
    setJobs((js ?? []) as Job[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [user]);

  const create = async () => {
    if (!firmId || !form.title || !form.description) { toast.error("Title and description required"); return; }
    setCreating(true);
    const { error } = await supabase.from("job_postings").insert({
      firm_id: firmId, title: form.title, description: form.description,
      job_type: form.job_type, location: form.location || null,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setForm({ title: "", description: "", job_type: "full_time", location: "" });
    toast.success("Posted");
    void load();
  };

  const toggle = async (j: Job) => {
    await supabase.from("job_postings").update({ is_active: !j.is_active }).eq("id", j.id);
    void load();
  };
  const del = async (j: Job) => {
    if (!confirm("Delete job?")) return;
    await supabase.from("job_postings").delete().eq("id", j.id);
    void load();
  };

  if (loading) return <Loader2 className="size-5 animate-spin text-primary" />;
  if (!firmId) return <p className="text-sm text-muted-foreground">Set up your firm profile first.</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Corporate Firms</p>
        <h1 className="text-2xl font-semibold">Job postings</h1>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Plus className="size-4" /> New posting</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Type</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })}>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="internship">Internship</option>
              <option value="contract">Contract</option>
            </select>
          </div>
          <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button className="bg-gradient-primary" disabled={creating} onClick={create}>{creating ? <Loader2 className="size-4 animate-spin" /> : "Post job"}</Button>
        </div>
      </div>

      <div className="space-y-3">
        {jobs.length === 0 && <p className="text-sm text-muted-foreground">No postings yet.</p>}
        {jobs.map((j) => (
          <div key={j.id} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{j.title}</p>
                <p className="text-xs text-muted-foreground">{j.job_type.replace("_", " ")} · {j.location ?? "Remote"}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{j.description}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => toggle(j)}>{j.is_active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</Button>
                <Button size="sm" variant="ghost" onClick={() => del(j)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
