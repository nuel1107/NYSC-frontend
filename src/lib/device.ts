import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { supabase } from "@/integrations/supabase/client";

let _fp: Promise<string> | null = null;

export function getDeviceFingerprint(): Promise<string> {
  if (_fp) return _fp;
  _fp = (async () => {
    const fp = await FingerprintJS.load();
    const r = await fp.get();
    return r.visitorId;
  })();
  return _fp;
}

export type DeviceCheck =
  | { state: "ok" }
  | { state: "locked"; activeFingerprint: string };

/** Reconciles the current browser fingerprint against the user's bound device. */
export async function reconcileDevice(userId: string): Promise<DeviceCheck> {
  const fingerprint = await getDeviceFingerprint();
  const label = navigator.userAgent.slice(0, 120);

  const { data: active } = await supabase
    .from("user_devices")
    .select("id, fingerprint")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!active) {
    await supabase.from("user_devices").insert({
      user_id: userId,
      fingerprint,
      label,
      is_active: true,
    });
    return { state: "ok" };
  }

  if (active.fingerprint === fingerprint) {
    await supabase
      .from("user_devices")
      .update({ last_seen: new Date().toISOString(), label })
      .eq("id", active.id);
    return { state: "ok" };
  }

  return { state: "locked", activeFingerprint: active.fingerprint };
}
