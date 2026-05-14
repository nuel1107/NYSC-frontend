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
import { supabase } from "@/integrations/supabase/client";
import { useAuth, rolePortalPath, type AppRole } from "@/hooks/use-auth";

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
  { value: "corps_member", label: "Corps Member" },
  { value: "admin", label: "Admin", note: "LGI approval required" },
  { value: "lgi", label: "LGI Super-Admin", note: "Auto-approved if seat is open" },
  { value: "media_editor", label: "Media Editor", note: "LGI approval required" },
  { value: "corporate_firm", label: "Corporate Firm", note: "LGI approval required" },
];

async function getApprovedPrimaryRole(userId: string): Promise<AppRole | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "approved");

  if (error) throw error;

  const roles = ((data ?? []) as { role: AppRole }[]).map((item) => item.role);
  const order: AppRole[] = ["lgi", "admin", "media_editor", "corporate_firm", "corps_member"];
  return order.find((item) => roles.includes(item)) ?? null;
}

function AuthPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { user, primaryRole, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<AppRole>("corps_member");

  useEffect(() => {
    if (!loading && user && primaryRole) {
      void navigate({ to: rolePortalPath(primaryRole) });
    }
  }, [user, primaryRole, loading, navigate]);

  const onSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = signinSchema.safeParse({ email: f.get("email"), password: f.get("password") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    try {
      const nextRole = data.user ? await getApprovedPrimaryRole(data.user.id) : null;
      if (nextRole) void navigate({ to: rolePortalPath(nextRole) });
      else toast.error("This account is still awaiting portal approval.");
    } catch {
      toast.error("Sign in worked, but your portal could not be loaded. Please try again.");
    }
  };

  const onSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);

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

    const meta: Record<string, string> = {
      full_name: fullName,
      role,
      phone: String(f.get("phone") ?? ""),
    };

    if (role === "corps_member") {
      meta.state_code = String(f.get("state_code") ?? "");
      meta.batch = String(f.get("batch") ?? "");
      meta.stream = String(f.get("stream") ?? "");
      meta.cds_group = String(f.get("cds_group") ?? "");
    } else if (role === "admin" || role === "lgi") {
      meta.portal_number = String(f.get("portal_number") ?? "");
    } else if (role === "corporate_firm") {
      meta.firm_company_name = String(f.get("firm_company_name") ?? "");
      meta.num_staff = String(f.get("num_staff") ?? "");
      meta.industry = String(f.get("industry") ?? "");
      meta.applicant_role = String(f.get("applicant_role") ?? "");
      meta.csr_focus = String(f.get("csr_focus") ?? "");
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: base.data.email,
      password: base.data.password,
      options: { emailRedirectTo: `${window.location.origin}/`, data: meta },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    // Corporate firm: create firm row owned by new user
    if (role === "corporate_firm" && data.user) {
      await supabase.from("corporate_firms").insert({
        owner_id: data.user.id,
        company_name: meta.firm_company_name,
        email: base.data.email,
        phone: meta.phone || null,
        industry: meta.industry || null,
        applicant_role: meta.applicant_role || null,
        num_staff: meta.num_staff ? Number(meta.num_staff) : null,
        csr_focus: meta.csr_focus || null,
      });
    }

    setBusy(false);
    if (role === "corps_member") toast.success("Welcome aboard. You're approved.");
    else if (role === "lgi")
      toast.success("Account created. If the LGI seat is open, you're approved.");
    else toast.success("Account created. Awaiting LGI approval.");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden bg-gradient-hero p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm opacity-90 hover:opacity-100"
        >
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

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={onSignIn} className="space-y-4">
                <Field label="Email" name="email" type="email" autoComplete="email" required />
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                <Button disabled={busy} className="w-full bg-gradient-primary shadow-elegant">
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Sign in
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/lgi-login">
                    <KeyRound className="mr-2 size-4" /> LGI direct access
                  </Link>
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={onSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Account type</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                          {r.note ? ` — ${r.note}` : ""}
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
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                />

                {role === "corps_member" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="State code" name="state_code" placeholder="LA/24A/0001" />
                      <Field label="Batch" name="batch" placeholder="2024 Batch A" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Stream" name="stream" placeholder="Stream I" />
                      <Field label="CDS group" name="cds_group" placeholder="ICT CDS" />
                    </div>
                  </>
                )}

                {(role === "admin" || role === "lgi") && (
                  <Field
                    label="Portal/Staff number"
                    name="portal_number"
                    placeholder="LGI-001"
                    required
                  />
                )}

                {role === "corporate_firm" && (
                  <>
                    <Field label="Company name" name="firm_company_name" required />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Industry" name="industry" placeholder="FinTech" />
                      <Field label="Number of staff" name="num_staff" type="number" min={1} />
                    </div>
                    <Field
                      label="Your role at the firm"
                      name="applicant_role"
                      placeholder="HR Director"
                    />
                    <Field label="CSR focus" name="csr_focus" placeholder="Youth empowerment" />
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
