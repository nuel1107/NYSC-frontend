import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/saed")({
  component: AdminSaed,
});

type Skill = { id: string; name: string; description: string | null; category: string | null; is_active: boolean };
type Course = { id: string; title: string; body: string | null; resource_url: string | null; skill_id: string | null };
type App = { id: string; user_id: string; skill_id: string; pitch: string; status: string; created_at: string; user?: { full_name: string } | null };

function AdminSaed() {
  const { user } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [skillForm, setSkillForm] = useState({ name: "", category: "", description: "" });
  const [courseForm, setCourseForm] = useState({ title: "", body: "", resource_url: "", skill_id: "" });

  const load = async () => {
    const { data: s } = await supabase.from("skills").select("*").order("name");
    setSkills((s ?? []) as Skill[]);
    const { data: c } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
    setCourses((c ?? []) as Course[]);
    const { data: a } = await supabase.from("tutor_applications").select("*").order("created_at", { ascending: false });
    const list = (a ?? []) as App[];
    const ids = Array.from(new Set(list.map((x) => x.user_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const m = new Map((ps ?? []).map((p) => [p.id, { full_name: p.full_name }] as const));
      list.forEach((x) => { x.user = m.get(x.user_id) ?? null; });
    }
    setApps(list);
  };
  useEffect(() => { void load(); }, []);

  const addSkill = async () => {
    if (!skillForm.name) return;
    const { error } = await supabase.from("skills").insert(skillForm);
    if (error) { toast.error(error.message); return; }
    setSkillForm({ name: "", category: "", description: "" });
    void load();
  };
  const saveSkill = async (s: Skill) => {
    await supabase.from("skills").update({ name: s.name, category: s.category, description: s.description, is_active: s.is_active }).eq("id", s.id);
    toast.success("Saved");
  };
  const delSkill = async (s: Skill) => { if (confirm("Delete?")) { await supabase.from("skills").delete().eq("id", s.id); void load(); } };

  const addCourse = async () => {
    if (!courseForm.title) return;
    const { error } = await supabase.from("courses").insert({
      title: courseForm.title, body: courseForm.body || null,
      resource_url: courseForm.resource_url || null, skill_id: courseForm.skill_id || null,
      created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    setCourseForm({ title: "", body: "", resource_url: "", skill_id: "" });
    void load();
  };
  const delCourse = async (c: Course) => { if (confirm("Delete?")) { await supabase.from("courses").delete().eq("id", c.id); void load(); } };

  const decideApp = async (a: App, status: "approved" | "rejected") => {
    await supabase.from("tutor_applications").update({ status, reviewed_by: user?.id ?? null }).eq("id", a.id);
    await supabase.from("notifications").insert({ title: `Tutor application ${status}`, body: "", target_user_id: a.user_id });
    void load();
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">SAED 2.0</p>
        <h1 className="text-2xl font-semibold">Skills, courses & tutors</h1>
      </div>

      <Tabs defaultValue="skills">
        <TabsList>
          <TabsTrigger value="skills">Skills ({skills.length})</TabsTrigger>
          <TabsTrigger value="courses">Courses ({courses.length})</TabsTrigger>
          <TabsTrigger value="tutors">Tutor apps ({apps.filter(a => a.status === "pending").length})</TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="mt-4 space-y-3">
          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Plus className="size-4" /> New skill</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input placeholder="Name" value={skillForm.name} onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })} />
              <Input placeholder="Category" value={skillForm.category} onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })} />
              <Input placeholder="Description" value={skillForm.description} onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })} />
            </div>
            <div className="mt-3 flex justify-end"><Button onClick={addSkill}>Add</Button></div>
          </div>
          {skills.map((s, i) => (
            <div key={s.id} className="rounded-2xl border bg-card p-4 shadow-card grid gap-2 sm:grid-cols-[2fr_1fr_2fr_auto_auto] items-end">
              <Input value={s.name} onChange={(e) => { const n = [...skills]; n[i] = { ...s, name: e.target.value }; setSkills(n); }} />
              <Input value={s.category ?? ""} onChange={(e) => { const n = [...skills]; n[i] = { ...s, category: e.target.value }; setSkills(n); }} />
              <Input value={s.description ?? ""} onChange={(e) => { const n = [...skills]; n[i] = { ...s, description: e.target.value }; setSkills(n); }} />
              <Button size="sm" onClick={() => saveSkill(s)}><Save className="size-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => delSkill(s)}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="courses" className="mt-4 space-y-3">
          <div className="rounded-2xl border bg-card p-4 shadow-card space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold"><Plus className="size-4" /> New course</p>
            <Input placeholder="Title" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
            <Input placeholder="Resource URL" value={courseForm.resource_url} onChange={(e) => setCourseForm({ ...courseForm, resource_url: e.target.value })} />
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={courseForm.skill_id} onChange={(e) => setCourseForm({ ...courseForm, skill_id: e.target.value })}>
              <option value="">— No skill —</option>
              {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Textarea rows={2} placeholder="Description" value={courseForm.body} onChange={(e) => setCourseForm({ ...courseForm, body: e.target.value })} />
            <div className="flex justify-end"><Button onClick={addCourse}>Add course</Button></div>
          </div>
          {courses.map((c) => (
            <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-card flex items-start justify-between">
              <div className="min-w-0">
                <p className="font-semibold">{c.title}</p>
                {c.resource_url && <a href={c.resource_url} className="text-xs text-primary hover:underline">{c.resource_url}</a>}
                {c.body && <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => delCourse(c)}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="tutors" className="mt-4 space-y-3">
          {apps.length === 0 && <p className="text-sm text-muted-foreground">No tutor applications.</p>}
          {apps.map((a) => {
            const skill = skills.find((s) => s.id === a.skill_id);
            return (
              <div key={a.id} className="rounded-2xl border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{a.user?.full_name ?? "Unknown"} → {skill?.name ?? "Skill"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{a.status}</span>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap">{a.pitch}</p>
                {a.status === "pending" && (
                  <div className="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => decideApp(a, "rejected")}>Reject</Button>
                    <Button size="sm" className="bg-gradient-primary" onClick={() => decideApp(a, "approved")}>Approve</Button>
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
