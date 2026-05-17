import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Reset password — Ikeja LGA" }] }),
});

function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email) {
      toast.error("Enter your email");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Reset link sent. Check your inbox.");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-subtle p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-elegant">
        <Link
          to="/auth"
          search={{ tab: "signin" }}
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
            <Mail className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Forgot your password?</h1>
            <p className="text-sm text-muted-foreground">
              We'll email you a secure reset link.
            </p>
          </div>
        </div>

        {sent ? (
          <p className="rounded-lg border bg-muted/40 p-4 text-sm">
            If an account exists for that email, a reset link is on its way. The link expires in
            1 hour.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <Button disabled={busy} className="w-full bg-gradient-primary shadow-elegant">
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Send reset link
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
