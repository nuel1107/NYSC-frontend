import { createFileRoute } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";

export const Route = createFileRoute("/_authenticated/media/")({
  component: () => (
    <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
      <Newspaper className="mx-auto size-10 text-primary" />
      <h1 className="mt-3 text-xl font-semibold">News House</h1>
      <p className="mt-1 text-sm text-muted-foreground">Article editor coming next. Use Admin → News for now.</p>
    </div>
  ),
});
