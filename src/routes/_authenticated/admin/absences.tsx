import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/absences")({
  component: AdminComplaints,
});

type C = {
  id: string; user_id: string; subject: string; body: string; status: string;
  reviewer_note: string | null; created_at: string; attachment_url: string | null;
  user?: { full_name: string; portal_number: string | null } | null;
};

function AdminComplaints() {
  const { user } = useAuth();
  const [items, setItems] = useState<C[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("complaints").select("*").order("created_at", { ascending: false }).limit(200);
    const list = (data ?? []) as C[];
    const ids = Array.from(new Set(list.map((c) => c.user_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name,portal_number").in("id", ids);
      const m = new Map((ps ?? []).map((p) => [p.id, { full_name: p.full_name, portal_number: p.portal_number }] as const));
      list.forEach((c) => { c.user = m.get(c.user_id) ?? null; });
    }
    setItems(list);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const decide = async (c: C, status: "approved" | "rejected") => {
    const { error } = await supabase.from("complaints").update({
      status, reviewer_note: note || c.reviewer_note, reviewed_by: user?.id ?? null,
    }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("notifications").insert({
      title: `Complaint ${status}`, body: c.subject, target_user_id: c.user_id,
    });
    toast.success("Updated");
    setNoteFor(null); setNote("");
    void load();
  };

  if (loading) return <Loader2 className="size-5 animate-spin text-primary" />;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Review</p>
        <h1 className="text-2xl font-semibold">Complaints</h1>
      </div>
      {items.length === 0 && <p className="text-sm text-muted-foreground">No complaints yet.</p>}
      <div className="space-y-3">
        {items.map((c) => (
          <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="font-semibold">{c.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {c.user?.full_name ?? "Unknown"} {c.user?.portal_number ? `· #${c.user.portal_number}` : ""} · {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.status === "approved" ? "bg-emerald-100 text-emerald-900" : c.status === "rejected" ? "bg-rose-100 text-rose-900" : "bg-amber-100 text-amber-900"}`}>{c.status}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{c.body}</p>
            {c.attachment_url && <a href={c.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-primary hover:underline">View attachment</a>}
            {c.reviewer_note && <p className="mt-2 rounded-lg bg-muted p-2 text-xs"><span className="font-semibold">Note:</span> {c.reviewer_note}</p>}

            {c.status === "pending" && (
              <div className="mt-3 space-y-2">
                {noteFor === c.id && <Textarea rows={2} placeholder="Optional note to user…" value={note} onChange={(e) => setNote(e.target.value)} />}
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setNoteFor(noteFor === c.id ? null : c.id); setNote(""); }}>
                    <MessageSquare className="mr-1 size-4" /> Note
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide(c, "rejected")}><X className="mr-1 size-4" /> Reject</Button>
                  <Button size="sm" className="bg-gradient-primary" onClick={() => decide(c, "approved")}><Check className="mr-1 size-4" /> Approve</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
