import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Lock, Unlock, Crosshair, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getCurrentPosition } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/admin/qr")({
  component: AdminEvents,
});

type Ev = {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  radius_m: number;
  starts_at: string;
  ends_at: string;
  attendance_locked: boolean;
  locked_by_role: string | null;
  created_by: string | null;
};

function AdminEvents() {
  const { user, primaryRole } = useAuth();
  const isLgi = primaryRole === "lgi";
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const [form, setForm] = useState({
    name: "", description: "", latitude: "", longitude: "", radius_m: "100",
    starts_at: "", ends_at: "",
  });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("events").select("*").order("starts_at", { ascending: false });
    const list = (data ?? []) as Ev[];
    setEvents(list);
    if (list.length) {
      const { data: ac } = await supabase
        .from("event_attendance")
        .select("event_id")
        .in("event_id", list.map((e) => e.id))
        .not("clock_in_at", "is", null);
      const m: Record<string, number> = {};
      (ac ?? []).forEach((r) => { m[r.event_id] = (m[r.event_id] ?? 0) + 1; });
      setCounts(m);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const useMyLocation = async () => {
    try {
      const p = await getCurrentPosition();
      setForm((f) => ({ ...f, latitude: p.lat.toFixed(6), longitude: p.lng.toFixed(6) }));
      toast.success("Pinned current location");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get location");
    }
  };

  const create = async () => {
    if (!user) return;
    if (!form.name || !form.latitude || !form.longitude || !form.starts_at || !form.ends_at) {
      toast.error("Fill in all required fields"); return;
    }
    setCreating(true);
    const { error } = await supabase.from("events").insert({
      name: form.name,
      description: form.description || null,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      radius_m: parseInt(form.radius_m || "100", 10),
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      created_by: user.id,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Event created");
    setForm({ name: "", description: "", latitude: "", longitude: "", radius_m: "100", starts_at: "", ends_at: "" });
    void load();
  };

  const toggleLock = async (ev: Ev) => {
    const { error } = await supabase.rpc("set_event_lock", { _event_id: ev.id, _lock: !ev.attendance_locked });
    if (error) { toast.error(error.message); return; }
    toast.success(ev.attendance_locked ? "Unlocked" : "Locked");
    void load();
  };

  const remove = async (ev: Ev) => {
    if (!confirm(`Delete event "${ev.name}"?`)) return;
    const { error } = await supabase.from("events").delete().eq("id", ev.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Attendance</p>
        <h1 className="text-2xl font-semibold">Events & Geofence</h1>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Plus className="size-4" /> New event</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Latitude</Label><Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="6.6018" /></div>
          <div><Label>Longitude</Label><Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="3.3515" /></div>
          <div><Label>Radius (m)</Label><Input type="number" value={form.radius_m} onChange={(e) => setForm({ ...form, radius_m: e.target.value })} /></div>
          <div className="flex items-end"><Button type="button" size="sm" variant="outline" onClick={useMyLocation}><Crosshair className="mr-1 size-4" /> Use my location</Button></div>
          <div><Label>Starts</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
          <div><Label>Ends</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button className="bg-gradient-primary" disabled={creating} onClick={create}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : "Create event"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">All events</h2>
        {loading && <Loader2 className="size-5 animate-spin text-primary" />}
        {!loading && events.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
        {events.map((ev) => {
          const lockedByLgi = ev.attendance_locked && ev.locked_by_role === "lgi";
          const canToggle = isLgi || !lockedByLgi;
          return (
            <div key={ev.id} className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{ev.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)} · {ev.radius_m}m</span>
                    <span>·</span>
                    <span>{new Date(ev.starts_at).toLocaleString()} → {new Date(ev.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <span>·</span>
                    <span>{counts[ev.id] ?? 0} clocked in</span>
                  </p>
                  {ev.attendance_locked && (
                    <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                      Locked by {ev.locked_by_role?.toUpperCase()}{lockedByLgi && !isLgi ? " — only LGI can unlock" : ""}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" disabled={!canToggle} onClick={() => toggleLock(ev)}>
                    {ev.attendance_locked ? <><Unlock className="mr-1 size-4" /> Unlock</> : <><Lock className="mr-1 size-4" /> Lock</>}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(ev)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
