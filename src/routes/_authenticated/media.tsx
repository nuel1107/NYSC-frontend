import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, rolePortalPath } from "@/hooks/use-auth";
import { PortalShell, mediaNav } from "@/components/portal/PortalShell";

export const Route = createFileRoute("/_authenticated/media")({
  component: MediaLayout,
});

function MediaLayout() {
  const { primaryRole, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && primaryRole && primaryRole !== "media_editor") {
      void navigate({ to: rolePortalPath(primaryRole) });
    }
  }, [primaryRole, loading, navigate]);

  return (
    <PortalShell items={mediaNav} role="media_editor">
      <Outlet />
    </PortalShell>
  );
}
