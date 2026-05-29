import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { api, ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: String(s.token ?? ""),
  }),
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Set new password — Ikeja LGA" }] }),
});

function ResetPasswordPage() {
  const navigate      = useNavigate();
  const { token }     = Route.useSearch();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error("Reset link is invalid or expired. Request a new one.");
      void navigate({ to: "/forgot-password" });
    }
  }, [token, navigate]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f        = new FormData(e.currentTarget);
    const password = String(f.get("password") ?? "");
    const confirm  = String(f.get("confirm")  ?? "");
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      toast.success("Password updated. Please sign in.");
      void navigate({ to: "/auth", search: { tab: "signin" } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to reset password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-subtle p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-elegant">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Set a new password</h1>
            <p className="text-sm text-muted-foreground">Use at least 6 characters.</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </div>
          <Button disabled={busy} className="w-full bg-gradient-primary shadow-elegant">
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
