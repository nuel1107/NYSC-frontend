import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldAlert, Loader2, Smartphone, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button }        from "@/components/ui/button";
import { Textarea }      from "@/components/ui/textarea";
import { Label }         from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth }       from "@/hooks/use-auth";
import { api, ApiError } from "@/lib/api-client";
import { getDeviceIp }   from "@/lib/device";

export const Route = createFileRoute("/device-change")({
  component: DeviceChangePage,
  head: () => ({ meta: [{ title: "Device change request — Ikeja LGA" }] }),
});

type ReqRow = {
  id: string;
  status: "pending" | "approved" | "rejected";
  path: "old_device" | "admin";
  reason: string;
  created_at: string;
};

function DeviceChangePage() {
  const { userId, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy,     setBusy]    = useState(false);
  const [path,     setPath]    = useState<"old_device" | "admin">("old_device");
  const [reason,   setReason]  = useState("");
  const [existing, setExisting] = useState<ReqRow | null>(null);

  useEffect(() => {
    if (!loading && !userId) void navigate({ to: "/auth" });
  }, [userId, loading, navigate]);

  useEffect(() => {
    if (!userId) return;
    api.get<ReqRow[]>("/devices/change-requests")
      .then((rows) => setExisting(rows[0] ?? null))
      .catch(() => {});
  }, [userId]);

  const submit = async () => {
    if (!userId) return;
    if (reason.trim().length < 10) {
      toast.error("Please describe what happened (10+ chars)");
      return;
    }
    setBusy(true);
    try {
      const fingerprint = await getDeviceIp();
      const data = await api.post<ReqRow>("/devices/change-request", {
        new_fingerprint: fingerprint,
        new_label:       navigator.userAgent.slice(0, 120),
        reason:          reason.trim(),
        path,
      });
      setExisting(data);
      toast.success(
        path === "old_device"
          ? "Request sent to your previous device for approval"
          : "Request sent to administrators",
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to submit request");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-subtle p-6">
      <div className="w-full max-w-lg rounded-3xl border bg-card p-6 shadow-elegant">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Security</p>
            <h1 className="text-lg font-semibold">New device detected</h1>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Your account is bound to a different device. To use this device, request a transfer.
          Approval will sign the previous device out automatically.
        </p>

        {existing && existing.status === "pending" ? (
          <div className="mt-6 rounded-2xl border bg-accent/30 p-4">
            <p className="text-sm font-medium">Request pending</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Path: {existing.path === "old_device" ? "Old-device approval" : "Administrator review"}
            </p>
            <p className="mt-2 text-sm">{existing.reason}</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Approval path</Label>
              <RadioGroup
                value={path}
                onValueChange={(v) => setPath(v as typeof path)}
                className="grid gap-2"
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-accent/50">
                  <RadioGroupItem value="old_device" id="p-old" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">My old device works (recommended)</p>
                    <p className="text-xs text-muted-foreground">Approve from your previous device — fastest path.</p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-accent/50">
                  <RadioGroupItem value="admin" id="p-adm" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Phone lost or stolen</p>
                    <p className="text-xs text-muted-foreground">Route to LGA administrators.</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason">What happened?</Label>
              <Textarea
                id="reason"
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="New phone, lost device, browser reinstall, etc."
              />
            </div>

            <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary">
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              <Smartphone className="mr-2 size-4" /> Submit request
            </Button>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => { await signOut(); void navigate({ to: "/auth" }); }}
          >
            <LogOut className="mr-2 size-4" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
