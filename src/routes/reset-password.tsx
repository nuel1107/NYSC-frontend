import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Set new password — Ikeja LGA" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase recovery link sets a session via the URL hash automatically.
    // Wait for the auth client to finish, then verify a session exists.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        toast.error("Reset link is invalid or expired. Request a new one.");
        void navigate({ to: "/forgot-password" });
        return;
      }
      setReady(true);
    }, 250);
    return () => clearTimeout(t);
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password") ?? "");
    const confirm = String(f.get("confirm") ?? "");
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    void navigate({ to: "/auth", search: { tab: "signin" } });
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

        {!ready ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
