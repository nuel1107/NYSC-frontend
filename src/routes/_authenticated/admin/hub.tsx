import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, GraduationCap, Users2, Trophy, Building2, Bell, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/hub")({
  component: () => {
    const tiles = [
      { to: "/admin/absences", icon: FileText, title: "Complaints", desc: "Review submissions" },
      { to: "/admin/notifications", icon: Bell, title: "Notifications", desc: "Broadcast alerts" },
      { to: "/admin/saed", icon: GraduationCap, title: "SAED 2.0", desc: "Manage skills & courses" },
      { to: "/admin/clubs", icon: Users2, title: "Clubs", desc: "Edit & approve members" },
      { to: "/admin/rankings", icon: Trophy, title: "CDS Rankings", desc: "Publish leaderboard" },
      { to: "/admin/firms", icon: Building2, title: "Firms", desc: "Approve partners" },
      { to: "/admin/metrics", icon: BarChart3, title: "Impact metrics", desc: "Edit public stats" },
    ];
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Modules</p>
          <h1 className="text-2xl font-semibold">Admin tools</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((t) => (
            <Link key={t.to} to={t.to} className="group rounded-2xl border bg-card p-4 shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elegant">
              <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground transition-smooth group-hover:bg-gradient-primary group-hover:text-primary-foreground">
                <t.icon className="size-5" />
              </div>
              <p className="mt-3 font-semibold">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  },
});
