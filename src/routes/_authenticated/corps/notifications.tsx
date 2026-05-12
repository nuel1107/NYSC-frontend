import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/corps/notifications")({
  component: CorpsNotifications,
});

type N = { id: string; title: string; body: string; created_at: string; is_global: boolean };

function CorpsNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<N[]>([]);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").or(`is_global.eq.true,target_user_id.eq.${user.id}`).order("created_at", { ascending: false }).limit(100);
    setItems((data ?? []) as N[]);
    const { data: r } = await supabase.from("notification_reads").select("notification_id").eq("user_id", user.id);
    setReadSet(new Set((r ?? []).map((x) => x.notification_id)));
    setLoading(false);
  };
  useEffect(() => { void load(); }, [user]);

  useEffect(() => {
    if (!user || items.length === 0) return;
    const unread = items.filter((n) => !readSet.has(n.id));
    if (unread.length === 0) return;
    void supabase.from("notification_reads").upsert(unread.map((n) => ({ notification_id: n.id, user_id: user.id })), { onConflict: "notification_id,user_id" });
  }, [items, readSet, user]);

  if (loading) return <Loader2 className="size-5 animate-spin text-primary" />;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Inbox</p>
        <h1 className="text-2xl font-semibold">Notifications</h1>
      </div>
      {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className={`rounded-2xl border bg-card p-4 shadow-card ${!readSet.has(n.id) ? "ring-1 ring-primary/40" : ""}`}>
            <div className="flex items-start gap-3">
              <Bell className="size-4 text-primary shrink-0 mt-1" />
              <div className="min-w-0">
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
