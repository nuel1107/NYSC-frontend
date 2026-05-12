import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Bell, GraduationCap, Users2, Trophy, Briefcase } from "lucide-react";

export const Route = createFileRoute("/_authenticated/corps/hub")({
  component: () => {
    const tiles = [
      { to: "/corps/complaints", icon: FileText, title: "Complaints", desc: "Submit and track issues" },
      { to: "/corps/notifications", icon: Bell, title: "Notifications", desc: "Latest from LGA" },
      { to: "/corps/saed", icon: GraduationCap, title: "SAED 2.0", desc: "Skills & courses" },
      { to: "/corps/clubs", icon: Users2, title: "Clubs", desc: "Join interest groups" },
      { to: "/corps/rankings", icon: Trophy, title: "CDS Rankings", desc: "Monthly leaderboard" },
      { to: "/corps/jobs", icon: Briefcase, title: "Job Board", desc: "Opportunities from firms" },
    ];
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Modules</p>
          <h1 className="text-2xl font-semibold">Everything else</h1>
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
