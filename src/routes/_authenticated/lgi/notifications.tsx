import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/lgi/notifications")({
  component: LGINotifications,
});

type N = { id: string; title: string; body: string; created_at: string; is_global: boolean };

function LGINotifications() {
  const [items, setItems] = useState<N[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100).then(({ data }) => {
      setItems((data ?? []) as N[]); setLoading(false);
    });
  }, []);

  if (loading) return <Loader2 className="size-5 animate-spin text-primary" />;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">LGI Console</p>
        <h1 className="text-2xl font-semibold">All notifications</h1>
      </div>
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <Bell className="size-4 text-primary shrink-0 mt-1" />
              <div className="min-w-0">
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.is_global ? "Global" : "Targeted"} · {new Date(n.created_at).toLocaleString()}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
