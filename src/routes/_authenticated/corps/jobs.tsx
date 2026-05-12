import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Briefcase, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/corps/jobs")({
  component: JobBoard,
});

type Job = { id: string; firm_id: string; title: string; description: string; job_type: string; location: string | null; created_at: string };

function JobBoard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [firms, setFirms] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("job_postings").select("*").eq("is_active", true).order("created_at", { ascending: false });
      const list = (data ?? []) as Job[];
      setJobs(list);
      const ids = Array.from(new Set(list.map((j) => j.firm_id)));
      if (ids.length) {
        const { data: fs } = await supabase.from("corporate_firms").select("id,company_name").in("id", ids).eq("status", "approved");
        const m: Record<string, string> = {};
        (fs ?? []).forEach((f) => { m[f.id] = f.company_name; });
        setFirms(m);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader2 className="size-5 animate-spin text-primary" />;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Job Board</p>
        <h1 className="text-2xl font-semibold">Opportunities from partner firms</h1>
      </div>
      {jobs.length === 0 && <p className="text-sm text-muted-foreground">No job postings yet.</p>}
      <div className="space-y-3">
        {jobs.filter((j) => firms[j.firm_id]).map((j) => (
          <div key={j.id} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Briefcase className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{j.title}</p>
                <p className="text-xs text-muted-foreground">{firms[j.firm_id]} · {j.job_type.replace("_", " ")}{j.location ? ` · ${j.location}` : ""}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{j.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
