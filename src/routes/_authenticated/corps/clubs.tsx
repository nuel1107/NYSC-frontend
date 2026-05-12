import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Users2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/corps/clubs")({
  component: ClubsPage,
});

type Club = { id: string; name: string; description: string | null; cover_url: string | null; category: string | null; is_active: boolean };

function ClubsPage() {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [memberships, setMemberships] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("clubs").select("*").eq("is_active", true).order("name");
    setClubs((data ?? []) as Club[]);
    if (user) {
      const { data: m } = await supabase.from("club_memberships").select("club_id,status").eq("user_id", user.id);
      const map: Record<string, string> = {};
      (m ?? []).forEach((r) => { map[r.club_id] = r.status; });
      setMemberships(map);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [user]);

  const join = async (c: Club) => {
    if (!user) return;
    setBusy(c.id);
    const { error } = await supabase.from("club_memberships").insert({ user_id: user.id, club_id: c.id });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Request sent");
    setMemberships({ ...memberships, [c.id]: "pending" });
  };
  const leave = async (c: Club) => {
    if (!user) return;
    setBusy(c.id);
    await supabase.from("club_memberships").delete().eq("user_id", user.id).eq("club_id", c.id);
    setBusy(null);
    const next = { ...memberships }; delete next[c.id]; setMemberships(next);
  };

  if (loading) return <Loader2 className="size-5 animate-spin text-primary" />;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Clubs</p>
        <h1 className="text-2xl font-semibold">Find your tribe</h1>
      </div>
      {clubs.length === 0 && <p className="text-sm text-muted-foreground">No clubs published yet — check back soon.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {clubs.map((c) => {
          const status = memberships[c.id];
          return (
            <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  {c.category && <p className="text-xs text-muted-foreground">{c.category}</p>}
                </div>
                <Users2 className="size-5 text-primary" />
              </div>
              {c.description && <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>}
              <div className="mt-3">
                {status === "approved" ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900"><Check className="size-3" /> Member</span>
                    <Button size="sm" variant="ghost" onClick={() => leave(c)}>Leave</Button>
                  </div>
                ) : status === "pending" ? (
                  <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Pending approval</span>
                ) : (
                  <Button size="sm" className="bg-gradient-primary" disabled={busy === c.id} onClick={() => join(c)}>
                    {busy === c.id ? <Loader2 className="size-4 animate-spin" /> : "Join club"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
