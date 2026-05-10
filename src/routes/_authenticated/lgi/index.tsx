import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, UserCheck, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/lgi/")({
  component: LGIHome,
});

function LGIHome() {
  const [pending, setPending] = useState(0);
  const [metricsCount, setMetricsCount] = useState(0);

  useEffect(() => {
    void supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("status", "pending").then(({ count }) => setPending(count ?? 0));
    void supabase.from("impact_metrics").select("id", { count: "exact", head: true }).then(({ count }) => setMetricsCount(count ?? 0));
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-elegant">
        <div className="flex items-center gap-3">
          <Shield className="size-6" />
          <div>
            <p className="text-xs opacity-80">Master Control</p>
            <h1 className="text-2xl font-semibold">LGI Super-Admin</h1>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/lgi/approvals" className="rounded-2xl border bg-card p-5 shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elegant">
          <UserCheck className="size-5 text-primary" />
          <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Pending approvals</p>
          <p className="mt-1 text-3xl font-semibold">{pending}</p>
          <p className="mt-1 text-xs text-muted-foreground">Admin & elevated role requests</p>
        </Link>
        <Link to="/lgi/metrics" className="rounded-2xl border bg-card p-5 shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elegant">
          <BarChart3 className="size-5 text-primary" />
          <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">Tracked metrics</p>
          <p className="mt-1 text-3xl font-semibold">{metricsCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Synced across all portals</p>
        </Link>
      </div>
    </div>
  );
}
