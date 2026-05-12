import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, GraduationCap, BookOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/corps/saed")({
  component: SAED,
});

type Skill = { id: string; name: string; description: string | null; category: string | null };
type Course = { id: string; title: string; body: string | null; resource_url: string | null; skill_id: string | null };

function SAED() {
  const { user } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [active, setActive] = useState<Skill | null>(null);
  const [pitch, setPitch] = useState("");
  const [busy, setBusy] = useState(false);
  const [myApps, setMyApps] = useState<Record<string, string>>({});

  useEffect(() => {
    void supabase.from("skills").select("*").eq("is_active", true).order("name").then(({ data }) => setSkills((data ?? []) as Skill[]));
    void supabase.from("courses").select("*").order("created_at", { ascending: false }).then(({ data }) => setCourses((data ?? []) as Course[]));
    if (user) {
      void supabase.from("tutor_applications").select("skill_id,status").eq("user_id", user.id).then(({ data }) => {
        const m: Record<string, string> = {};
        (data ?? []).forEach((a) => { if (a.skill_id) m[a.skill_id] = a.status; });
        setMyApps(m);
      });
    }
  }, [user]);

  const apply = async () => {
    if (!user || !active || !pitch) return;
    setBusy(true);
    const { error } = await supabase.from("tutor_applications").insert({ user_id: user.id, skill_id: active.id, pitch });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Application submitted");
    setMyApps({ ...myApps, [active.id]: "pending" });
    setActive(null); setPitch("");
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">SAED 2.0</p>
        <h1 className="text-2xl font-semibold">Skills & courses</h1>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Available skills</h2>
        {skills.length === 0 && <p className="text-sm text-muted-foreground">No skills published yet.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {skills.map((s) => (
            <div key={s.id} className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  {s.category && <p className="text-xs text-muted-foreground">{s.category}</p>}
                </div>
                <GraduationCap className="size-5 text-primary" />
              </div>
              {s.description && <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>}
              <div className="mt-3">
                {myApps[s.id] ? (
                  <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">Tutor: {myApps[s.id]}</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setActive(s)}>Apply to tutor</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {active && (
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <p className="text-sm font-semibold">Apply: {active.name}</p>
          <Label className="mt-3 block">Why are you a great tutor?</Label>
          <Textarea rows={3} value={pitch} onChange={(e) => setPitch(e.target.value)} />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setActive(null); setPitch(""); }}>Cancel</Button>
            <Button className="bg-gradient-primary" disabled={busy || !pitch} onClick={apply}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Submit"}</Button>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Courses</h2>
        {courses.length === 0 && <p className="text-sm text-muted-foreground">No courses yet.</p>}
        <div className="space-y-2">
          {courses.map((c) => (
            <a key={c.id} href={c.resource_url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elegant">
              <div className="flex items-center gap-3">
                <BookOpen className="size-5 text-primary" />
                <div>
                  <p className="font-medium">{c.title}</p>
                  {c.body && <p className="text-xs text-muted-foreground line-clamp-1">{c.body}</p>}
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
