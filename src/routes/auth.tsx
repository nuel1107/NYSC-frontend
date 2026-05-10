import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import { Shield, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, rolePortalPath, type AppRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: (s.tab as string) === "signup" ? "signup" : "signin" }),
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Ikeja LGA" }] }),
});

const signinSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(128),
});

const signupSchema = signinSchema.extend({
  fullName: z.string().trim().min(2, "Name required").max(100),
  stateCode: z.string().trim().max(20).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  requestedRole: z.enum(["corps_member", "admin", "lgi", "media_editor"]),
});

function AuthPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { user, primaryRole, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && primaryRole) {
      void navigate({ to: rolePortalPath(primaryRole) });
    }
  }, [user, primaryRole, loading, navigate]);

  const onSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = signinSchema.safeParse({ email: f.get("email"), password: f.get("password") });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome back");
  };

  const onSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      email: f.get("email"), password: f.get("password"),
      fullName: f.get("fullName"), stateCode: f.get("stateCode"),
      phone: f.get("phone"), requestedRole: f.get("requestedRole"),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: parsed.data.fullName, state_code: parsed.data.stateCode, phone: parsed.data.phone },
      },
    });
    if (error) { setBusy(false); toast.error(error.message); return; }

    // If a non-corps role was requested, insert a pending role row.
    const requested = parsed.data.requestedRole as AppRole;
    if (data.user && requested !== "corps_member") {
      await supabase.from("user_roles").insert({ user_id: data.user.id, role: requested, status: "pending" });
      toast.success("Account created. Your elevated role is awaiting LGI approval.");
    } else {
      toast.success("Account created. Welcome aboard.");
    }
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden bg-gradient-hero p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm opacity-90 hover:opacity-100">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <div className="grid size-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <Shield className="size-6" />
          </div>
          <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Ikeja LGA NYSC Digital Ecosystem.
          </h1>
          <p className="max-w-md text-white/80">
            Sign in to your portal — Corps Member, Admin, Media Editor, or LGI Super-Admin.
          </p>
        </motion.div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} Ikeja LGA Secretariat.</p>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-6 text-center lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Home</Link>
          </div>
          <Tabs defaultValue={tab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={onSignIn} className="space-y-4">
                <Field label="Email" name="email" type="email" autoComplete="email" required />
                <Field label="Password" name="password" type="password" autoComplete="current-password" required />
                <Button disabled={busy} className="w-full bg-gradient-primary shadow-elegant">
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={onSignUp} className="space-y-4">
                <Field label="Full name" name="fullName" required />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="State code" name="stateCode" placeholder="LA/24A/0001" />
                  <Field label="Phone" name="phone" type="tel" />
                </div>
                <Field label="Email" name="email" type="email" autoComplete="email" required />
                <Field label="Password" name="password" type="password" autoComplete="new-password" required />
                <div className="space-y-1.5">
                  <Label>Account type</Label>
                  <Select name="requestedRole" defaultValue="corps_member">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corps_member">Corps Member</SelectItem>
                      <SelectItem value="admin">Admin (LGI approval required)</SelectItem>
                      <SelectItem value="media_editor">Media Editor (LGI approval required)</SelectItem>
                      <SelectItem value="lgi">LGI Super-Admin (LGI approval required)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button disabled={busy} className="w-full bg-gradient-primary shadow-elegant">
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
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
