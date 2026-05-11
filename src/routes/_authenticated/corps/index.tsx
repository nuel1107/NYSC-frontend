import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, FileText, QrCode, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/corps/")({
  component: CorpsHome,
});

interface Metric { metric_key: string; label: string; value: number; unit: string | null }

function CorpsHome() {
  const { profile, user } = useAuth();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [pendingAbsences, setPendingAbsences] = useState(0);

  useEffect(() => {
    void supabase.from("impact_metrics").select("metric_key,label,value,unit").order("display_order").then(({ data }) => setMetrics(data ?? []));
    if (user) {
      void supabase.from("event_attendance").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("clock_in_at", "is", null).then(({ count }) => setAttendanceCount(count ?? 0));
      void supabase.from("complaints").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending").then(({ count }) => setPendingAbsences(count ?? 0));
    }
  }, [user]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-elegant"
      >
        <p className="text-sm opacity-80">Welcome back</p>
        <h1 className="mt-1 text-2xl font-semibold">{profile?.full_name?.split(" ")[0]}</h1>
        <p className="mt-1 text-sm opacity-80">{profile?.state_code ?? "Set your state code in settings"}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="CDS attended" value={String(attendanceCount)} icon={CheckCircle2} />
          <Stat label="Pending leave" value={String(pendingAbsences)} icon={Clock} />
        </div>
      </motion.div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <ActionCard icon={QrCode} title="Scan QR" desc="Mark CDS attendance" to="/corps/scan" />
          <ActionCard icon={FileText} title="Request leave" desc="Submit absence" to="/corps/absence" />
          <ActionCard icon={Users} title="Community" desc="Connect with corps" to="/corps/community" />
          <ActionCard icon={Sparkles} title="News House" desc="Read latest updates" to="/corps/news" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ikeja LGA Impact</h2>
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <div key={m.metric_key} className="rounded-2xl border bg-card p-4 shadow-card">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="mt-1 text-2xl font-semibold">
                {m.unit === "NGN" ? "₦" : ""}{Number(m.value).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
      <Icon className="size-4 opacity-80" />
      <p className="mt-2 text-xs opacity-80">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

import { Link } from "@tanstack/react-router";

function ActionCard({ icon: Icon, title, desc, to }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string; to: string }) {
  return (
    <Link to={to} className="group rounded-2xl border bg-card p-4 shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elegant">
      <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground transition-smooth group-hover:bg-gradient-primary group-hover:text-primary-foreground">
        <Icon className="size-5" />
      </div>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </Link>
  );
}
