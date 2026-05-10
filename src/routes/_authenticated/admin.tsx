import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, rolePortalPath } from "@/hooks/use-auth";
import { PortalShell, adminNav } from "@/components/portal/PortalShell";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { primaryRole, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && primaryRole && primaryRole !== "admin") {
      void navigate({ to: rolePortalPath(primaryRole) });
    }
  }, [primaryRole, loading, navigate]);

  return (
    <PortalShell items={adminNav} role="admin">
      <Outlet />
    </PortalShell>
  );
}
