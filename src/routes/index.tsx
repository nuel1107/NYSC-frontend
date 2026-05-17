import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shield, QrCode, Users, BarChart3, Newspaper, Bell, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, rolePortalPath } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Ikeja LGA Digital Ecosystem — NYSC Management" },
      { name: "description", content: "Tri-portal NYSC platform: attendance, SAED, community, and impact reporting for Ikeja LGA." },
    ],
  }),
});

function Landing() {
  const { user, primaryRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && primaryRole) {
      void navigate({ to: rolePortalPath(primaryRole) });
    }
  }, [user, primaryRole, loading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Nav */}
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-primary shadow-elegant">
            <Shield className="size-5 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">Ikeja LGA</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link to="/news" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">News House</Link>
          <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link to="/auth" search={{ tab: "signup" } as never}><Button size="sm" className="bg-gradient-primary shadow-elegant">Get started</Button></Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 pt-12 pb-20 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card"
          >
            <span className="size-1.5 rounded-full bg-success" /> Tri-portal · Real-time · Secure
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl"
          >
            The digital nerve center for{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">Ikeja NYSC</span>.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground"
          >
            One synchronized ecosystem for Corps members, Admins, and the LGI Super-Admin -
            attendance via rotating QR, leave-of-absence workflow, community hub, and live impact reporting.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link to="/auth" search={{ tab: "signup" } as never}>
              <Button size="lg" className="bg-gradient-primary shadow-elegant">
                Create account <ArrowRight className="ml-1 size-4" />
              </Button>
            </Link>
            <Link to="/news"><Button size="lg" variant="outline">Read News House</Button></Link>
          </motion.div>
        </div>

        {/* Feature grid */}
        <div className="mx-auto mt-20 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: QrCode, t: "Rotating QR Attendance", d: "Admins generate a daily event; corps scan to mark attendance." },
            { icon: Users, t: "Community Hub", d: "Peer networking with watermark protection on every screen." },
            { icon: Shield, t: "Absence Workflow", d: "Submit leave requests with attachments. Admins approve in real time." },
            { icon: BarChart3, t: "Impact Metrics", d: "Funds generated, beneficiaries, SAED — updated live." },
            { icon: Newspaper, t: "News House", d: "Public reporting site managed by Media Editors." },
            { icon: Bell, t: "Notifications", d: "Targeted or global alerts with unread badges." },
          ].map((f, i) => (
            <motion.div
              key={f.t}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="rounded-2xl border bg-card p-5 shadow-card transition-smooth hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </motion.div>
          ))}
        </div>

        {/* Tri-portal callout */}
        <div className="mx-auto mt-20 max-w-5xl rounded-3xl border bg-gradient-hero p-1 shadow-elegant">
          <div className="rounded-[calc(var(--radius)+10px)] bg-card p-8 sm:p-12">
            <h2 className="text-3xl font-semibold tracking-tight">Three portals. One source of truth.</h2>
            <p className="mt-2 text-muted-foreground">Every action — synchronized in real time.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { name: "Corps Member", c: "Attendance, SAED, community, absence requests." },
                { name: "Admin", c: "Approve absences, generate QR, post news, set metrics." },
                { name: "LGI Super-Admin", c: "Approve admin signups, monitor everything." },
              ].map((p) => (
                <div key={p.name} className="rounded-xl border bg-background/60 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="size-4 text-primary" /> {p.name}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{p.c}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-card/50 py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Ikeja LGA NYSC Digital Ecosystem.</span>
          <span>Built for service. Secured by design.</span>
        </div>
      </footer>
    </div>
  );
}
