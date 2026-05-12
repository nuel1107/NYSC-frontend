import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Image as ImageIcon, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/corps/community")({
  component: Community,
});

type Post = {
  id: string; user_id: string; content: string; image_url: string | null; created_at: string;
  author?: { full_name: string; avatar_url: string | null } | null;
};

function Community() {
  const { user, primaryRole } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    const { data } = await supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(50);
    const list = (data ?? []) as Post[];
    const ids = Array.from(new Set(list.map((p) => p.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,avatar_url").in("id", ids);
      const m = new Map((profs ?? []).map((p) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }] as const));
      list.forEach((p) => { p.author = m.get(p.user_id) ?? null; });
    }
    setPosts(list);
  };
  useEffect(() => {
    void load();
    const ch = supabase.channel("comm").on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, load).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const submit = async () => {
    if (!user || !content.trim()) return;
    setBusy(true);
    let image_url: string | null = null;
    if (imageFile) {
      const path = `${user.id}/${Date.now()}-${imageFile.name}`;
      const { error } = await supabase.storage.from("community-media").upload(path, imageFile);
      if (!error) {
        const { data } = supabase.storage.from("community-media").getPublicUrl(path);
        image_url = data.publicUrl;
      }
    }
    const { error } = await supabase.from("community_posts").insert({ user_id: user.id, content, image_url });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setContent(""); setImageFile(null);
    toast.success("Posted");
    void load();
  };

  const del = async (p: Post) => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("community_posts").delete().eq("id", p.id);
    void load();
  };

  const canDelete = (p: Post) => user?.id === p.user_id || primaryRole === "admin" || primaryRole === "lgi";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Community</p>
        <h1 className="text-2xl font-semibold">Corps Hub</h1>
      </div>

      {user && (
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <Textarea rows={3} placeholder="Share with your fellow corps members…" value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="mt-3 flex items-center justify-between">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <ImageIcon className="mr-1 size-4" /> {imageFile ? imageFile.name.slice(0, 18) : "Add image"}
            </Button>
            <Button size="sm" className="bg-gradient-primary" disabled={busy || !content.trim()} onClick={submit}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <><Send className="mr-1 size-4" /> Post</>}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {posts.length === 0 && <p className="text-sm text-muted-foreground">No posts yet — be the first.</p>}
        {posts.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
                  {(p.author?.full_name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{p.author?.full_name ?? "Member"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
                </div>
              </div>
              {canDelete(p) && (
                <Button size="sm" variant="ghost" onClick={() => del(p)}><Trash2 className="size-4" /></Button>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm">{p.content}</p>
            {p.image_url && <img src={p.image_url} alt="" className="mt-3 w-full rounded-xl border" />}
          </div>
        ))}
      </div>
    </div>
  );
}
