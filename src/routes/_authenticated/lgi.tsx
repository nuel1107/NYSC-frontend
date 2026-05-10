import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, rolePortalPath } from "@/hooks/use-auth";
import { PortalShell, lgiNav } from "@/components/portal/PortalShell";

export const Route = createFileRoute("/_authenticated/lgi")({
  component: LGILayout,
});

function LGILayout() {
  const { primaryRole, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && primaryRole && primaryRole !== "lgi") {
      void navigate({ to: rolePortalPath(primaryRole) });
    }
  }, [primaryRole, loading, navigate]);

  return (
    <PortalShell items={lgiNav} role="lgi">
      <Outlet />
    </PortalShell>
  );
}
