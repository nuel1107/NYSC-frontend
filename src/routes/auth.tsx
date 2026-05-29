import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import { Shield, ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  signIn,
  signUp,
  rolePortalPath,
  primaryRoleFromRows,
  useAuth,
  type AppRole,
} from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (s.tab as string) === "signup" ? "signup" : "signin",
  }),
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Ikeja LGA" }] }),
});

const signinSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(128),
});

const ROLES: { value: AppRole; label: string; note?: string }[] = [
  { value: "corps_member",   label: "Corps Member" },
  { value: "admin",          label: "Admin",          note: "LGI approval required" },
  { value: "lgi",            label: "LGI Super-Admin", note: "Auto-approved if seat is open" },
  { value: "media_editor",   label: "Media Editor",   note: "LGI approval required" },
  { value: "corporate_firm", label: "Corporate Firm", note: "LGI approval required" },
];

function AuthPage() {
  const { tab }                       = Route.useSearch();
  const navigate                      = useNavigate();
  const { userId, primaryRole, loading, refresh } = useAuth();
  const [busy,  setBusy]              = useState(false);
  const [role,  setRole]              = useState<AppRole>("corps_member");

  // Redirect if already signed in
  useEffect(() => {
    if (!loading && userId && primaryRole) {
      void navigate({ to: rolePortalPath(primaryRole) });
    }
  }, [userId, primaryRole, loading, navigate]);

  // ── Sign in ──────────────────────────────────────────────────────────────
  const onSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f      = new FormData(e.currentTarget);
    const parsed = signinSchema.safeParse({ email: f.get("email"), password: f.get("password") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const data    = await signIn(parsed.data.email, parsed.data.password);
      await refresh();                          // update AuthContext state
      const next    = primaryRoleFromRows(data.user.roles);
      if (next) {
        toast.success("Welcome back");
        void navigate({ to: rolePortalPath(next) });
      } else {
        toast.error("This account is still awaiting portal approval.");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Sign up ──────────────────────────────────────────────────────────────
  const onSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f    = new FormData(e.currentTarget);
    const base = signinSchema.safeParse({ email: f.get("email"), password: f.get("password") });
    if (!base.success) {
      toast.error(base.error.issues[0].message);
      return;
    }
    const fullName = String(f.get("fullName") ?? "").trim();
    if (fullName.length < 2) {
      toast.error("Full name is required");
      return;
    }

    const payload: Parameters<typeof signUp>[0] = {
      email:     base.data.email,
      password:  base.data.password,
      role,
      full_name: fullName,
      phone:     String(f.get("phone") ?? "") || undefined,
    };

    if (role === "corps_member") {
      payload.state_code = String(f.get("state_code") ?? "") || undefined;
      payload.batch      = String(f.get("batch")      ?? "") || undefined;
      payload.stream     = String(f.get("stream")     ?? "") || undefined;
      payload.cds_group  = String(f.get("cds_group")  ?? "") || undefined;
    } else if (role === "admin" || role === "lgi") {
      payload.portal_number = String(f.get("portal_number") ?? "") || undefined;
    } else if (role === "corporate_firm") {
      payload.firm_company_name = String(f.get("firm_company_name") ?? "") || undefined;
      payload.industry          = String(f.get("industry")          ?? "") || undefined;
      payload.applicant_role    = String(f.get("applicant_role")    ?? "") || undefined;
      payload.csr_focus         = String(f.get("csr_focus")         ?? "") || undefined;
      const ns = Number(f.get("num_staff"));
      if (ns > 0) payload.num_staff = ns;
    }

    setBusy(true);
    try {
      const data = await signUp(payload);
      await refresh();
      const next = primaryRoleFromRows(data.user.roles);
      if (role === "corps_member")  toast.success("Welcome aboard. You're approved.");
      else if (role === "lgi")      toast.success("Account created. If the LGI seat is open, you're approved.");
      else                          toast.success("Account created. Awaiting LGI approval.");
      if (next) void navigate({ to: rolePortalPath(next) });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left panel */}
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
            Corps Member, Admin, Media, LGI Super-Admin, or Corporate Firm — one secure portal.
          </p>
        </motion.div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} Ikeja LGA Secretariat.</p>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-6 text-center lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowLeft className="size-4" /> Home
            </Link>
          </div>

          <Tabs defaultValue={tab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            {/* Sign In */}
            <TabsContent value="signin" className="mt-6">
              <form onSubmit={onSignIn} className="space-y-4">
                <Field label="Email"    name="email"    type="email"    autoComplete="email"            required />
                <Field label="Password" name="password" type="password" autoComplete="current-password" required />
                <Button disabled={busy} className="w-full bg-gradient-primary shadow-elegant">
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Sign in
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">
                    Forgot password?
                  </Link>
                  <Link to="/lgi-login" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <KeyRound className="size-3.5" /> LGI direct access
                  </Link>
                </div>
              </form>
            </TabsContent>

            {/* Sign Up */}
            <TabsContent value="signup" className="mt-6">
              <form onSubmit={onSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Account type</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}{r.note ? ` — ${r.note}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Field label="Full name" name="fullName" required />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email" name="email" type="email" autoComplete="email" required />
                  <Field label="Phone" name="phone" type="tel" />
                </div>
                <Field label="Password" name="password" type="password" autoComplete="new-password" required />

                {role === "corps_member" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="State code" name="state_code" placeholder="LA/24A/0001" />
                      <Field label="Batch"      name="batch"      placeholder="2024 Batch A" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Stream"    name="stream"    placeholder="Stream I" />
                      <Field label="CDS group" name="cds_group" placeholder="ICT CDS" />
                    </div>
                  </>
                )}

                {(role === "admin" || role === "lgi") && (
                  <Field label="Portal/Staff number" name="portal_number" placeholder="LGI-001" required />
                )}

                {role === "corporate_firm" && (
                  <>
                    <Field label="Company name" name="firm_company_name" required />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Industry"        name="industry"  placeholder="FinTech" />
                      <Field label="Number of staff" name="num_staff" type="number" min={1} />
                    </div>
                    <Field label="Your role at the firm" name="applicant_role" placeholder="HR Director" />
                    <Field label="CSR focus"             name="csr_focus"      placeholder="Youth empowerment" />
                  </>
                )}

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
