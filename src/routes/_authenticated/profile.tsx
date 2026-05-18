import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Smartphone, MapPin, Clock, ShieldCheck, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceFingerprint } from "@/lib/device";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Profile & device — Ikeja LGA" }] }),
});

type Device = {
  id: string;
  fingerprint: string;
  label: string | null;
  is_active: boolean;
  last_seen: string;
  created_at: string;
};

type GeoInfo = { city?: string; region?: string; country_name?: string; ip?: string };

function parseDevice(label: string | null): { browser: string; os: string } {
  const ua = label ?? "";
  let browser = "Unknown browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";

  let os = "Unknown OS";
  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return { browser, os };
}

function ProfilePage() {
  const { profile, user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [currentFp, setCurrentFp] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data }, fp] = await Promise.all([
        supabase
          .from("user_devices")
          .select("id,fingerprint,label,is_active,last_seen,created_at")
          .eq("user_id", user.id)
          .order("last_seen", { ascending: false }),
        getDeviceFingerprint(),
      ]);
      setDevices((data ?? []) as Device[]);
      setCurrentFp(fp);
      setLoading(false);
    })();

    void fetch("https://ipapi.co/json/")
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => g && setGeo(g))
      .catch(() => {});
  }, [user]);

  const active = devices.find((d) => d.is_active) ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Profile & security</h1>
        <p className="text-sm text-muted-foreground">Account details and the device currently bound to your account.</p>
      </header>

      <section className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
            <UserIcon className="size-5" />
          </div>
          <div>
            <p className="font-semibold leading-tight">{profile?.full_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Field label="State code" value={profile?.state_code ?? "—"} />
          <Field label="Phone" value={profile?.phone ?? "—"} />
          <Field label="CDS group" value={profile?.cds_group ?? "—"} />
          <Field label="Portal number" value={profile?.portal_number ?? "—"} />
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="font-semibold">Bound device</h2>
        </div>

        {loading ? (
          <div className="grid place-items-center py-8"><Loader2 className="size-5 animate-spin text-primary" /></div>
        ) : !active ? (
          <p className="text-sm text-muted-foreground">No active device bound yet. It will register on your next sign-in.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border bg-accent/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Smartphone className="mt-0.5 size-5 text-primary" />
                  <div>
                    <p className="font-medium">
                      {(() => { const d = parseDevice(active.label); return `${d.browser} on ${d.os}`; })()}
                      {active.fingerprint === currentFp && (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          This device
                        </span>
                      )}
                    </p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{active.label}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <InfoTile icon={MapPin} label="Location" value={
                  geo ? [geo.city, geo.region, geo.country_name].filter(Boolean).join(", ") || "Unknown" : "Detecting…"
                } sub={geo?.ip} />
                <InfoTile icon={Clock} label="Last active" value={new Date(active.last_seen).toLocaleString()} />
                <InfoTile icon={ShieldCheck} label="Bound since" value={new Date(active.created_at).toLocaleDateString()} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Location is approximated from your current IP address and reflects this browsing session. Only one device can be
              active at a time — sign-in from a new device will require a transfer request.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <p className="mt-1 text-sm font-medium">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
