import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, rolePortalPath } from "@/hooks/use-auth";
import { PortalShell, firmNav } from "@/components/portal/PortalShell";

export const Route = createFileRoute("/_authenticated/firm")({
  component: FirmLayout,
});

function FirmLayout() {
  const { primaryRole, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && primaryRole && primaryRole !== "corporate_firm") {
      void navigate({ to: rolePortalPath(primaryRole) });
    }
  }, [primaryRole, loading, navigate]);

  return (
    <PortalShell items={firmNav} role="corporate_firm">
      <Outlet />
    </PortalShell>
  );
}
