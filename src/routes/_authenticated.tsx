import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  component: Gate,
});

function Gate() {
  const { user, loading, deviceLocked } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) { void navigate({ to: "/auth" }); return; }
    if (deviceLocked && path !== "/device-change") {
      void navigate({ to: "/device-change" });
    }
  }, [user, loading, deviceLocked, path, navigate]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  return <Outlet />;
}
