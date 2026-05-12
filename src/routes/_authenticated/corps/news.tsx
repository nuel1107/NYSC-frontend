import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/corps/news")({
  component: CorpsNews,
});

type Article = { id: string; title: string; excerpt: string | null; body: string; cover_url: string | null; created_at: string };

function CorpsNews() {
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Article | null>(null);

  useEffect(() => {
    void supabase.from("news_articles").select("*").eq("published", true).order("created_at", { ascending: false }).then(({ data }) => {
      setItems((data ?? []) as Article[]); setLoading(false);
    });
  }, []);

  if (loading) return <Loader2 className="size-5 animate-spin text-primary" />;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">News House</p>
        <h1 className="text-2xl font-semibold">Latest from Ikeja LGA</h1>
      </div>

      {open ? (
        <article className="rounded-2xl border bg-card p-4 shadow-card">
          <button onClick={() => setOpen(null)} className="mb-3 text-xs text-primary hover:underline">← Back</button>
          {open.cover_url && <img src={open.cover_url} alt="" className="mb-4 w-full rounded-xl" />}
          <h2 className="text-xl font-semibold">{open.title}</h2>
          <p className="text-xs text-muted-foreground">{new Date(open.created_at).toLocaleDateString()}</p>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{open.body}</p>
        </article>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.length === 0 && <p className="text-sm text-muted-foreground">No published articles yet.</p>}
          {items.map((a) => (
            <button key={a.id} onClick={() => setOpen(a)} className="text-left rounded-2xl border bg-card shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elegant overflow-hidden">
              {a.cover_url && <img src={a.cover_url} alt="" className="aspect-video w-full object-cover" />}
              <div className="p-4">
                <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</p>
                <p className="mt-1 font-semibold">{a.title}</p>
                {a.excerpt && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.excerpt}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
