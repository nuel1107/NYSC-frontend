import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: AdminNotifications,
});

type N = { id: string; title: string; body: string; is_global: boolean; target_user_id: string | null; created_at: string };

function AdminNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<N[]>([]);
  const [form, setForm] = useState({ title: "", body: "", is_global: true });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
    setItems((data ?? []) as N[]);
  };
  useEffect(() => { void load(); }, []);

  const send = async () => {
    if (!user || !form.title || !form.body) { toast.error("Title and body required"); return; }
    setBusy(true);
    const { error } = await supabase.from("notifications").insert({
      title: form.title, body: form.body, is_global: form.is_global, created_by: user.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setForm({ title: "", body: "", is_global: true });
    toast.success("Broadcast sent");
    void load();
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Broadcast</p>
        <h1 className="text-2xl font-semibold">Notifications</h1>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card space-y-3">
        <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Body</Label><Textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        <div className="flex items-center gap-3">
          <Switch checked={form.is_global} onCheckedChange={(v) => setForm({ ...form, is_global: v })} />
          <Label>Send to all users</Label>
        </div>
        <div className="flex justify-end">
          <Button className="bg-gradient-primary" disabled={busy} onClick={send}>{busy ? <Loader2 className="size-4 animate-spin" /> : <><Send className="mr-1 size-4" /> Broadcast</>}</Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((n) => (
          <div key={n.id} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.is_global ? "Global" : "Targeted"} · {new Date(n.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
