import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/community")({
  component: AdminCommunity,
});

type Post = {
  id: string; user_id: string; content: string; image_url: string | null; created_at: string;
  author?: { full_name: string } | null;
};

function AdminCommunity() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(100);
    const list = (data ?? []) as Post[];
    const ids = Array.from(new Set(list.map((p) => p.user_id)));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const m = new Map((ps ?? []).map((p) => [p.id, { full_name: p.full_name }] as const));
      list.forEach((p) => { p.author = m.get(p.user_id) ?? null; });
    }
    setPosts(list);
  };
  useEffect(() => { void load(); }, []);

  const post = async () => {
    if (!user || !content) return;
    setBusy(true);
    const { error } = await supabase.from("community_posts").insert({ user_id: user.id, content, image_url: imageUrl || null });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setContent(""); setImageUrl("");
    toast.success("Posted");
    void load();
  };

  const del = async (p: Post) => {
    if (!confirm("Delete?")) return;
    await supabase.from("community_posts").delete().eq("id", p.id);
    void load();
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Community</p>
        <h1 className="text-2xl font-semibold">Manage feed</h1>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Megaphone className="size-4" /> Official post</p>
        <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Announcement, tip, or update…" />
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <div><Label className="text-xs">Image URL (optional)</Label><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" /></div>
          <Button className="self-end bg-gradient-primary" disabled={busy || !content} onClick={post}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Publish"}</Button>
        </div>
      </div>

      <div className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{p.author?.full_name ?? "Member"}</p>
                <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del(p)}><Trash2 className="size-4" /></Button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{p.content}</p>
            {p.image_url && <img src={p.image_url} alt="" className="mt-2 w-full rounded-xl border" />}
          </div>
        ))}
      </div>
    </div>
  );
}
