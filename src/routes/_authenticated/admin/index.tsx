import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, FileText, QrCode, Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const [stats, setStats] = useState({ corps: 0, pendingAbsence: 0, posts: 0, news: 0 });

  useEffect(() => {
    void Promise.all([
      supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "corps_member"),
      supabase.from("absence_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("community_posts").select("id", { count: "exact", head: true }),
      supabase.from("news_articles").select("id", { count: "exact", head: true }).eq("published", true),
    ]).then(([a, b, c, d]) => setStats({
      corps: a.count ?? 0, pendingAbsence: b.count ?? 0, posts: c.count ?? 0, news: d.count ?? 0,
    }));
  }, []);

  const tiles = [
    { label: "Corps members", value: stats.corps, icon: Users, to: "/admin/community" },
    { label: "Pending absences", value: stats.pendingAbsence, icon: FileText, to: "/admin/absences" },
    { label: "Community posts", value: stats.posts, icon: Users, to: "/admin/community" },
    { label: "Published articles", value: stats.news, icon: Newspaper, to: "/admin/news" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Overview</h1>
        <p className="text-sm text-muted-foreground">The nerve center for Ikeja LGA operations.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="rounded-2xl border bg-card p-5 shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elegant">
            <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <t.icon className="size-5" />
            </div>
            <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{t.label}</p>
            <p className="mt-1 text-3xl font-semibold">{t.value.toLocaleString()}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
            <QrCode className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">Today's QR Event</h2>
            <p className="text-sm text-muted-foreground">Generate a rotating code for CDS attendance.</p>
          </div>
          <Link to="/admin/qr" className="ml-auto rounded-lg bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant">Open</Link>
        </div>
      </div>
    </div>
  );
}
