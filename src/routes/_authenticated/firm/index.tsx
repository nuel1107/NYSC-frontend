import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, FileText, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/firm/")({
  component: FirmHome,
});

type Firm = {
  id: string; company_name: string; email: string; phone: string | null;
  num_staff: number | null; industry: string | null; applicant_role: string | null;
  csr_focus: string | null; status: string;
};
type Doc = { id: string; doc_name: string; url: string; uploaded_at: string };

function FirmHome() {
  const { user } = useAuth();
  const [firm, setFirm] = useState<Firm | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: f } = await supabase.from("corporate_firms").select("*").eq("owner_id", user.id).maybeSingle();
    setFirm(f as Firm | null);
    if (f) {
      const { data: d } = await supabase.from("firm_documents").select("id,doc_name,url,uploaded_at").eq("firm_id", f.id).order("uploaded_at", { ascending: false });
      setDocs((d ?? []) as Doc[]);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [user]);

  const ensureFirm = async () => {
    if (!user || firm) return firm;
    const { data, error } = await supabase.from("corporate_firms").insert({
      owner_id: user.id,
      email: user.email ?? "",
      company_name: "Untitled Company",
    }).select().single();
    if (error) { toast.error(error.message); return null; }
    setFirm(data as Firm);
    return data as Firm;
  };

  const save = async () => {
    if (!firm) return;
    setSaving(true);
    const { error } = await supabase.from("corporate_firms").update({
      company_name: firm.company_name, phone: firm.phone, num_staff: firm.num_staff,
      industry: firm.industry, applicant_role: firm.applicant_role, csr_focus: firm.csr_focus,
    }).eq("id", firm.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
  };

  const upload = async (file: File) => {
    if (!user) return;
    const f = firm ?? (await ensureFirm());
    if (!f) return;
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uErr } = await supabase.storage.from("firm-documents").upload(path, file);
    if (uErr) { setUploading(false); toast.error(uErr.message); return; }
    const { data: signed } = await supabase.storage.from("firm-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl ?? path;
    const { error } = await supabase.from("firm_documents").insert({ firm_id: f.id, doc_name: file.name, url });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Uploaded");
    void load();
  };

  if (loading) return <Loader2 className="size-5 animate-spin text-primary" />;

  if (!firm) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center shadow-card">
        <Building2 className="mx-auto size-10 text-primary" />
        <h1 className="mt-3 text-xl font-semibold">Welcome, partner firm</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set up your company profile to start posting jobs.</p>
        <Button className="mt-4 bg-gradient-primary" onClick={() => void ensureFirm()}>Create profile</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-elegant">
        <p className="text-xs opacity-80">Corporate Firms Portal</p>
        <h1 className="mt-1 text-2xl font-semibold">{firm.company_name}</h1>
        <p className="mt-1 text-xs opacity-80">Status: {firm.status.toUpperCase()}</p>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <p className="mb-3 text-sm font-semibold">Company profile</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Company name</Label><Input value={firm.company_name} onChange={(e) => setFirm({ ...firm, company_name: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={firm.phone ?? ""} onChange={(e) => setFirm({ ...firm, phone: e.target.value })} /></div>
          <div><Label>Number of staff</Label><Input type="number" value={firm.num_staff ?? ""} onChange={(e) => setFirm({ ...firm, num_staff: e.target.value ? parseInt(e.target.value, 10) : null })} /></div>
          <div><Label>Industry</Label><Input value={firm.industry ?? ""} onChange={(e) => setFirm({ ...firm, industry: e.target.value })} /></div>
          <div><Label>Your role</Label><Input value={firm.applicant_role ?? ""} onChange={(e) => setFirm({ ...firm, applicant_role: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>CSR focus</Label><Textarea rows={2} value={firm.csr_focus ?? ""} onChange={(e) => setFirm({ ...firm, csr_focus: e.target.value })} /></div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button className="bg-gradient-primary" disabled={saving} onClick={save}>{saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}</Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Documents</p>
          <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <><Upload className="mr-1 size-4" /> Upload</>}
          </Button>
        </div>
        {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="size-4 text-primary shrink-0" />
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm hover:underline">{d.doc_name}</a>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(d.uploaded_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
