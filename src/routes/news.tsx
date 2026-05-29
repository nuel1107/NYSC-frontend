import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Newspaper, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api-client";

interface Article {
  id: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  created_at: string;
}

export const Route = createFileRoute("/news")({
  component: NewsHouse,
  head: () => ({
    meta: [
      { title: "News House — Ikeja LGA NYSC" },
      { name: "description", content: "Public reports and impact stories from Ikeja LGA NYSC." },
    ],
  }),
});

function NewsHouse() {
  const [items, setItems] = useState<Article[]>([]);

  useEffect(() => {
    api.get<Article[]>("/news")
      .then(setItems)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Home
        </Link>
        <span className="text-sm font-semibold">News House</span>
      </header>

      <section className="container mx-auto px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <Newspaper className="mx-auto size-10 text-primary" />
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">News & Impact Reports</h1>
          <p className="mt-2 text-muted-foreground">Stories from Ikeja LGA NYSC's community service.</p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 ? (
            <p className="col-span-full text-center text-sm text-muted-foreground">
              No published articles yet.
            </p>
          ) : (
            items.map((a) => (
              <article
                key={a.id}
                className="rounded-2xl border bg-card shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elegant"
              >
                {a.cover_url && (
                  <img src={a.cover_url} alt={a.title} className="h-40 w-full rounded-t-2xl object-cover" />
                )}
                <div className="p-5">
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                  <h2 className="mt-1 font-semibold">{a.title}</h2>
                  {a.excerpt && <p className="mt-1 text-sm text-muted-foreground">{a.excerpt}</p>}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
