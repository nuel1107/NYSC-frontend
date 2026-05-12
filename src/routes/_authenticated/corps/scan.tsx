import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, LogIn, LogOut as LogOutIcon, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { distanceMeters, getCurrentPosition } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/corps/scan")({
  component: CorpsScan,
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
};

type Att = { id: string; event_id: string; clock_in_at: string | null; clock_out_at: string | null };

function CorpsScan() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Ev[]>([]);
  const [attMap, setAttMap] = useState<Record<string, Att>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const now = new Date().toISOString();
    const ago = new Date(Date.now() - 86400000).toISOString();
    const { data: evs } = await supabase
      .from("events")
      .select("id,name,description,latitude,longitude,radius_m,starts_at,ends_at,attendance_locked")
      .gte("ends_at", ago).order("starts_at", { ascending: true });
    setEvents((evs ?? []) as Ev[]);
    if (user && evs?.length) {
      const { data: atts } = await supabase
        .from("event_attendance")
        .select("id,event_id,clock_in_at,clock_out_at")
        .eq("user_id", user.id).in("event_id", evs.map((e) => e.id));
      const m: Record<string, Att> = {};
      (atts ?? []).forEach((a) => { m[a.event_id] = a as Att; });
      setAttMap(m);
    }
    setLoading(false);
    void now;
  };

  useEffect(() => { void load(); }, [user]);

  const clockIn = async (ev: Ev) => {
    if (!user) return;
    setBusy(ev.id);
    try {
      const pos = await getCurrentPosition();
      const dist = distanceMeters(pos.lat, pos.lng, ev.latitude, ev.longitude);
      if (dist > ev.radius_m) {
        toast.error(`You are ${Math.round(dist)}m away — must be within ${ev.radius_m}m`);
        return;
      }
      const { error } = await supabase.from("event_attendance").insert({
        event_id: ev.id, user_id: user.id,
        clock_in_at: new Date().toISOString(), clock_in_lat: pos.lat, clock_in_lng: pos.lng,
      });
      if (error) throw error;
      toast.success("Clocked in");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clock-in failed");
    } finally { setBusy(null); }
  };

  const clockOut = async (ev: Ev, att: Att) => {
    if (!user) return;
    setBusy(ev.id);
    try {
      const pos = await getCurrentPosition();
      const dist = distanceMeters(pos.lat, pos.lng, ev.latitude, ev.longitude);
      if (dist > ev.radius_m) {
        toast.error(`You are ${Math.round(dist)}m away — must be within ${ev.radius_m}m`);
        return;
      }
      const { error } = await supabase.from("event_attendance").update({
        clock_out_at: new Date().toISOString(), clock_out_lat: pos.lat, clock_out_lng: pos.lng,
      }).eq("id", att.id);
      if (error) throw error;
      toast.success("Clocked out");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clock-out failed");
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Attendance</p>
        <h1 className="text-2xl font-semibold">Geofenced clock-in / out</h1>
        <p className="text-sm text-muted-foreground">Be inside the event radius to mark attendance.</p>
      </div>

      {loading && <Loader2 className="size-5 animate-spin text-primary" />}
      {!loading && events.length === 0 && (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No events scheduled. Check back later.
        </div>
      )}

      <div className="space-y-3">
        {events.map((ev) => {
          const att = attMap[ev.id];
          const now = Date.now();
          const started = now >= new Date(ev.starts_at).getTime();
          const ended = now > new Date(ev.ends_at).getTime();
          const locked = ev.attendance_locked;
          const canIn = started && !ended && !locked && !att;
          const canOut = att && att.clock_in_at && !att.clock_out_at && !locked && !ended;

          return (
            <div key={ev.id} className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{ev.name}</p>
                  {ev.description && <p className="mt-0.5 text-sm text-muted-foreground">{ev.description}</p>}
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" /> {ev.radius_m}m radius ·{" "}
                    {new Date(ev.starts_at).toLocaleString()} – {new Date(ev.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {locked && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"><Lock className="size-3" /> Locked</span>}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {att?.clock_in_at && <>In: {new Date(att.clock_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>}
                  {att?.clock_out_at && <> · Out: {new Date(att.clock_out_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>}
                  {att?.clock_out_at && <span className="ml-2 inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="size-3" /> Complete</span>}
                </div>
                <div className="flex gap-2">
                  {canIn && (
                    <Button size="sm" className="bg-gradient-primary" disabled={busy === ev.id} onClick={() => clockIn(ev)}>
                      {busy === ev.id ? <Loader2 className="size-4 animate-spin" /> : <><LogIn className="mr-1 size-4" /> Clock in</>}
                    </Button>
                  )}
                  {canOut && (
                    <Button size="sm" variant="outline" disabled={busy === ev.id} onClick={() => clockOut(ev, att)}>
                      {busy === ev.id ? <Loader2 className="size-4 animate-spin" /> : <><LogOutIcon className="mr-1 size-4" /> Clock out</>}
                    </Button>
                  )}
                  {!canIn && !canOut && !att && !ended && !locked && (
                    <span className="text-xs text-muted-foreground">Opens {new Date(ev.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  )}
                  {ended && !att?.clock_in_at && <span className="text-xs text-muted-foreground">Ended</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
