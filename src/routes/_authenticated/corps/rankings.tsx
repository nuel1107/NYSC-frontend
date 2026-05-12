import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/corps/rankings")({
  component: Rankings,
});

type R = { id: string; cds_group: string; rank: number; benefits: string | null; notes: string | null; period_year: number; period_month: number };

function Rankings() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void supabase.from("cds_rankings").select("*").eq("period_year", year).eq("period_month", month).order("rank").then(({ data }) => {
      setItems((data ?? []) as R[]); setLoading(false);
    });
  }, [year, month]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">CDS Rankings</p>
        <h1 className="text-2xl font-semibold">Monthly leaderboard</h1>
      </div>

      <div className="flex gap-2">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
          {[year - 1, year, year + 1].map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("default", { month: "long" })}</option>)}
        </select>
      </div>

      {loading && <Loader2 className="size-5 animate-spin text-primary" />}
      {!loading && items.length === 0 && <p className="text-sm text-muted-foreground">No rankings published for this period.</p>}
      <div className="space-y-2">
        {items.map((r) => (
          <div key={r.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
            <div className={`grid size-12 place-items-center rounded-xl ${r.rank === 1 ? "bg-amber-100 text-amber-900" : r.rank === 2 ? "bg-slate-200 text-slate-900" : r.rank === 3 ? "bg-orange-100 text-orange-900" : "bg-muted"}`}>
              {r.rank <= 3 ? <Trophy className="size-5" /> : <span className="font-bold">#{r.rank}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{r.cds_group}</p>
              {r.benefits && <p className="text-xs text-emerald-700 dark:text-emerald-300">🎁 {r.benefits}</p>}
              {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
            </div>
            <div className="text-2xl font-bold text-muted-foreground">#{r.rank}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
