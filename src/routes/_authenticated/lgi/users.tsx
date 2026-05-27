import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Plus, X, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/lgi/users")({
  component: LGIUsers,
});

type RoleRow = { role: AppRole; status: "pending" | "approved" | "rejected" };
type UserRow = {
  id: string;
  full_name: string;
  portal_number: string | null;
  firm_company_name: string | null;
  phone: string | null;
  roles: RoleRow[];
};

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "corps_member", label: "Corps Member" },
  { value: "admin", label: "Admin" },
  { value: "lgi", label: "LGI Super-Admin" },
  { value: "media_editor", label: "Media Editor" },
  { value: "corporate_firm", label: "Corporate Firm" },
];

function LGIUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickRole, setPickRole] = useState<Record<string, AppRole>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: ps }, { data: rs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,portal_number,firm_company_name,phone")
        .order("full_name"),
      supabase.from("user_roles").select("user_id,role,status"),
    ]);
    const rolesByUser = new Map<string, RoleRow[]>();
    (rs ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push({ role: r.role as AppRole, status: r.status as RoleRow["status"] });
      rolesByUser.set(r.user_id, arr);
    });
    setUsers(
      (ps ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        portal_number: p.portal_number,
        firm_company_name: p.firm_company_name,
        phone: p.phone,
        roles: rolesByUser.get(p.id) ?? [],
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(s) ||
        (u.portal_number ?? "").toLowerCase().includes(s) ||
        (u.firm_company_name ?? "").toLowerCase().includes(s) ||
        (u.phone ?? "").toLowerCase().includes(s),
    );
  }, [users, q]);

  const assign = async (u: UserRow, role: AppRole, status: "approved" | "pending" = "approved") => {
    setBusyId(u.id);
    const { error } = await supabase.rpc("lgi_assign_role", {
      _user_id: u.id,
      _role: role,
      _status: status,
    });
    if (!error) {
      await supabase.from("notifications").insert({
        title: status === "approved" ? "Role assigned" : "Role pending",
        body: `You have been ${status === "approved" ? "granted" : "queued for"} ${role.replace("_", " ")} access.`,
        target_user_id: u.id,
      });
      toast.success("Role updated");
      await load();
    } else {
      toast.error(error.message);
    }
    setBusyId(null);
  };

  const remove = async (u: UserRow, role: AppRole) => {
    if (!confirm(`Remove ${role.replace("_", " ")} from ${u.full_name}?`)) return;
    setBusyId(u.id);
    const { error } = await supabase.rpc("lgi_remove_role", { _user_id: u.id, _role: role });
    if (error) toast.error(error.message);
    else {
      toast.success("Role removed");
      await load();
    }
    setBusyId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">LGI Console</p>
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search any account and assign or revoke portal roles. Use this to promote backend-created users.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, portal number, firm, phone…"
          className="pl-9"
        />
      </div>

      {loading && <Loader2 className="size-5 animate-spin text-primary" />}
      {!loading && filtered.length === 0 && (
        <div className="grid place-items-center rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          <UsersIcon className="mb-2 size-6" />
          No users match your search.
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((u) => {
          const selected = pickRole[u.id] ?? "corps_member";
          return (
            <div key={u.id} className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.portal_number ? `Portal #${u.portal_number}` : null}
                    {u.firm_company_name ? ` · ${u.firm_company_name}` : null}
                    {u.phone ? ` · ${u.phone}` : null}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {u.roles.length === 0 && (
                      <span className="text-xs text-muted-foreground">No roles assigned</span>
                    )}
                    {u.roles.map((r) => (
                      <Badge
                        key={r.role}
                        variant={r.status === "approved" ? "default" : "outline"}
                        className="gap-1"
                      >
                        {r.role.replace("_", " ")} · {r.status}
                        <button
                          type="button"
                          onClick={() => remove(u, r.role)}
                          className="ml-1 rounded hover:bg-muted/40"
                          disabled={busyId === u.id}
                          aria-label="Remove role"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Select
                    value={selected}
                    onValueChange={(v) => setPickRole((m) => ({ ...m, [u.id]: v as AppRole }))}
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="bg-gradient-primary"
                    disabled={busyId === u.id}
                    onClick={() => assign(u, selected, "approved")}
                  >
                    {busyId === u.id ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : (
                      <Plus className="mr-1 size-4" />
                    )}
                    Grant
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
