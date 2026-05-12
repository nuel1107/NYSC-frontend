import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/corps/complaints")({
  component: Complaints,
});

type C = {
  id: string; subject: string; body: string; status: string;
  reviewer_note: string | null; created_at: string; attachment_url: string | null;
};

function Complaints() {
  const { user } = useAuth();
  const [items, setItems] = useState<C[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("complaints").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setItems((data ?? []) as C[]);
  };
  useEffect(() => { void load(); }, [user]);

  const submit = async () => {
    if (!user || !form.subject || !form.body) { toast.error("Subject and body required"); return; }
    setBusy(true);
    let attachment_url: string | null = null;
    if (file) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("complaint-attachments").upload(path, file);
      if (!upErr) {
        const { data: signed } = await supabase.storage.from("complaint-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
        attachment_url = signed?.signedUrl ?? null;
      }
    }
    const { error } = await supabase.from("complaints").insert({
      user_id: user.id, subject: form.subject, body: form.body, attachment_url,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Submitted");
    setForm({ subject: "", body: "" }); setFile(null); setOpen(false);
    void load();
  };

  const statusColor = (s: string) =>
    s === "approved" ? "bg-emerald-100 text-emerald-900" : s === "rejected" ? "bg-rose-100 text-rose-900" : "bg-amber-100 text-amber-900";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Complaints</p>
          <h1 className="text-2xl font-semibold">My submissions</h1>
        </div>
        <Button size="sm" className="bg-gradient-primary" onClick={() => setOpen(!open)}><Plus className="mr-1 size-4" /> New</Button>
      </div>

      {open && (
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <div className="grid gap-3">
            <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div><Label>Details</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
            <div>
              <input ref={fileRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Paperclip className="mr-1 size-4" /> {file ? file.name.slice(0, 24) : "Attach"}</Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="bg-gradient-primary" disabled={busy} onClick={submit}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Submit"}</Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No complaints yet.</p>}
        {items.map((c) => (
          <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{c.subject}</p>
                <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(c.status)}`}>{c.status}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{c.body}</p>
            {c.attachment_url && <a href={c.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-primary hover:underline">View attachment</a>}
            {c.reviewer_note && <p className="mt-2 rounded-lg bg-muted p-2 text-xs"><span className="font-semibold">Response:</span> {c.reviewer_note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
