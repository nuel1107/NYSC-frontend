import { supabase } from "@/integrations/supabase/client";

let _ip: Promise<string> | null = null;

/** Fetch the public IP of this device (used as the device binding key). */
export function getDeviceIp(): Promise<string> {
  if (_ip) return _ip;
  _ip = (async () => {
    try {
      const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
      const json = (await res.json()) as { ip?: string };
      if (json.ip) return json.ip;
    } catch {
      // fall through
    }
    // Fallback: a deterministic local marker so binding still works offline.
    return "unknown-ip";
  })();
  return _ip;
}

export type DeviceCheck =
  | { state: "ok" }
  | { state: "locked"; activeFingerprint: string }
  | { state: "skipped" };

/**
 * Reconciles the current browser's public IP against the user's bound device.
 * LGI users are exempt — they may sign in from anywhere.
 */
export async function reconcileDevice(userId: string): Promise<DeviceCheck> {
  // Skip device binding entirely for LGI accounts.
  const { data: lgiRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "lgi")
    .eq("status", "approved")
    .maybeSingle();
  if (lgiRow) return { state: "skipped" };

  const ip = await getDeviceIp();
  const label = `IP ${ip} · ${navigator.userAgent.slice(0, 80)}`;

  const { data: active } = await supabase
    .from("user_devices")
    .select("id, fingerprint")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!active) {
    await supabase.from("user_devices").insert({
      user_id: userId,
      fingerprint: ip,
      label,
      is_active: true,
    });
    return { state: "ok" };
  }

  if (active.fingerprint === ip) {
    await supabase.rpc("touch_own_device", { _device_id: active.id, _label: label });
    return { state: "ok" };
  }

  return { state: "locked", activeFingerprint: active.fingerprint };
}
