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

export const Route = createFileRoute("/_authenticated/admin/news")({
  component: AdminNews,
});

type A = { id: string; title: string; excerpt: string | null; body: string; cover_url: string | null; published: boolean; created_at: string };

function AdminNews() {
  const { user } = useAuth();
  const [items, setItems] = useState<A[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", excerpt: "", body: "", cover_url: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("news_articles").select("*").order("created_at", { ascending: false });
    setItems((data ?? []) as A[]);
  };
  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (!user || !form.title || !form.body) { toast.error("Title and body required"); return; }
    setBusy(true);
    const { error } = await supabase.from("news_articles").insert({
      title: form.title, excerpt: form.excerpt || null, body: form.body,
      cover_url: form.cover_url || null, author_id: user.id, published: false,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setForm({ title: "", excerpt: "", body: "", cover_url: "" }); setOpen(false);
    toast.success("Draft saved");
    void load();
  };

  const togglePublish = async (a: A) => {
    await supabase.from("news_articles").update({ published: !a.published }).eq("id", a.id);
    void load();
  };
  const del = async (a: A) => {
    if (!confirm("Delete article?")) return;
    await supabase.from("news_articles").delete().eq("id", a.id);
    void load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">News House</p>
          <h1 className="text-2xl font-semibold">Articles</h1>
        </div>
        <Button size="sm" className="bg-gradient-primary" onClick={() => setOpen(!open)}><Plus className="mr-1 size-4" /> New</Button>
      </div>

      {open && (
        <div className="rounded-2xl border bg-card p-4 shadow-card space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Excerpt</Label><Input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></div>
          <div><Label>Cover image URL</Label><Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} /></div>
          <div><Label>Body</Label><Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-primary" disabled={busy} onClick={create}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Save draft"}</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.published ? "Published" : "Draft"} · {new Date(a.created_at).toLocaleDateString()}</p>
                {a.excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => togglePublish(a)}>{a.published ? <><EyeOff className="mr-1 size-4" /> Unpublish</> : <><Eye className="mr-1 size-4" /> Publish</>}</Button>
                <Button size="sm" variant="ghost" onClick={() => del(a)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
