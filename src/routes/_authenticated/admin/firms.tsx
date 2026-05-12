import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, X, Building2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/firms")({
  component: AdminFirms,
});

type Firm = {
  id: string; company_name: string; email: string; phone: string | null;
  num_staff: number | null; industry: string | null; csr_focus: string | null;
  status: string; owner_id: string;
};
type Doc = { id: string; firm_id: string; doc_name: string; url: string; uploaded_at: string };

function AdminFirms() {
  const { user } = useAuth();
  const [firms, setFirms] = useState<Firm[]>([]);
  const [docs, setDocs] = useState<Record<string, Doc[]>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("corporate_firms").select("*").order("created_at", { ascending: false });
    const list = (data ?? []) as Firm[];
    setFirms(list);
    if (list.length) {
      const { data: ds } = await supabase.from("firm_documents").select("*").in("firm_id", list.map((f) => f.id));
      const m: Record<string, Doc[]> = {};
      (ds ?? []).forEach((d) => { (m[d.firm_id] ??= []).push(d as Doc); });
      setDocs(m);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const decide = async (f: Firm, status: "approved" | "rejected") => {
    const { error } = await supabase.from("corporate_firms").update({
      status, reviewed_by: user?.id ?? null,
    }).eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("user_roles").update({ status }).eq("user_id", f.owner_id).eq("role", "corporate_firm");
    await supabase.from("notifications").insert({
      title: `Firm ${status}`, body: f.company_name, target_user_id: f.owner_id,
    });
    toast.success("Updated");
    void load();
  };

  if (loading) return <Loader2 className="size-5 animate-spin text-primary" />;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Partners</p>
        <h1 className="text-2xl font-semibold">Corporate firms</h1>
      </div>
      {firms.length === 0 && <p className="text-sm text-muted-foreground">No firms registered yet.</p>}
      <div className="space-y-3">
        {firms.map((f) => (
          <div key={f.id} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold"><Building2 className="size-4 text-primary" /> {f.company_name}</p>
                <p className="text-xs text-muted-foreground">{f.email} · {f.phone ?? "—"} · {f.industry ?? "—"} · {f.num_staff ?? "—"} staff</p>
                {f.csr_focus && <p className="mt-1 text-sm">CSR: {f.csr_focus}</p>}
                {(docs[f.id] ?? []).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {(docs[f.id] ?? []).map((d) => (
                      <li key={d.id} className="flex items-center gap-2 text-xs">
                        <FileText className="size-3 text-primary" />
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{d.doc_name}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.status === "approved" ? "bg-emerald-100 text-emerald-900" : f.status === "rejected" ? "bg-rose-100 text-rose-900" : "bg-amber-100 text-amber-900"}`}>{f.status}</span>
                {f.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => decide(f, "rejected")}><X className="size-4" /></Button>
                    <Button size="sm" className="bg-gradient-primary" onClick={() => decide(f, "approved")}><Check className="size-4" /></Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
