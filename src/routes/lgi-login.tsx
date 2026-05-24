import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/lgi-login")({
  component: LGILoginPage,
  head: () => ({ meta: [{ title: "LGI Direct Login — Ikeja LGA" }] }),
});

const lgiSigninSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(128),
});

async function hasApprovedLGIRole(userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "lgi")
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

function LGILoginPage() {
  const navigate = useNavigate();
  const { user, primaryRole, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && primaryRole === "lgi") {
      void navigate({ to: "/lgi" });
    }
  }, [user, primaryRole, loading, navigate]);

  const onLGISignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = lgiSigninSchema.safeParse({
      email: f.get("email"),
      password: f.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    try {
      const allowed = data.user ? await hasApprovedLGIRole(data.user.id) : false;
      setBusy(false);
      if (!allowed) {
        await supabase.auth.signOut();
        toast.error("This account does not have approved LGI Super-Admin access. Sign up with the LGI role to claim the open seat.");
        return;
      }
      toast.success("Welcome, LGI Super-Admin");
      void navigate({ to: "/lgi" });
    } catch {
      setBusy(false);
      toast.error("LGI access could not be verified. Please try again.");
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-subtle p-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <Link
          to="/auth"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Standard login
        </Link>

        <div className="rounded-3xl border bg-card p-6 shadow-elegant">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Direct portal access
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">LGI Super-Admin</h1>
            </div>
          </div>

          <form onSubmit={onLGISignIn} className="space-y-4">
            <Field
              label="LGI email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="your-lgi-email@example.com"
              required
            />
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            <Button disabled={busy} className="w-full bg-gradient-primary shadow-elegant">
              {busy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 size-4" />
              )}
              Enter LGI Portal
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={rest.name}>{label}</Label>
      <Input id={rest.name} {...rest} />
    </div>
  );
}
