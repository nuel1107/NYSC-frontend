import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, rolePortalPath } from "@/hooks/use-auth";
import { PortalShell, corpsNav } from "@/components/portal/PortalShell";

export const Route = createFileRoute("/_authenticated/corps")({
  component: CorpsLayout,
});

function CorpsLayout() {
  const { primaryRole, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && primaryRole && primaryRole !== "corps_member") {
      void navigate({ to: rolePortalPath(primaryRole) });
    }
  }, [primaryRole, loading, navigate]);

  return (
    <PortalShell items={corpsNav} role="corps_member">
      <Outlet />
    </PortalShell>
  );
}
