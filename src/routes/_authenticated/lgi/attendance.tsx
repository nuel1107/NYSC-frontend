import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/lgi/attendance")({
  component: () => (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">LGI Console</p>
      <h1 className="text-2xl font-semibold">Attendance Override</h1>
      <p className="text-sm text-muted-foreground">
        Use the events manager to lock or unlock attendance per event. As LGI, your locks override admin locks.
      </p>
      <Link to="/admin/qr" className="inline-flex items-center rounded-lg bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant">
        Open Events Manager
      </Link>
    </div>
  ),
});
