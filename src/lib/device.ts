/**
 * device.ts
 * Device binding — replaces direct Supabase calls with FastAPI /devices/reconcile
 */
import { api } from "@/lib/api-client";

let _ip: Promise<string> | null = null;

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
    return "unknown-ip";
  })();
  return _ip;
}

export type DeviceCheck =
  | { state: "ok" }
  | { state: "locked"; activeFingerprint: string }
  | { state: "skipped" };

export async function reconcileDevice(_userId: string): Promise<DeviceCheck> {
  // userId is no longer needed client-side — the JWT carries identity
  const ip    = await getDeviceIp();
  const label = `IP ${ip} · ${navigator.userAgent.slice(0, 80)}`;

  const result = await api.post<DeviceCheck>("/devices/reconcile", {
    fingerprint: ip,
    label,
  });

  return result;
}
