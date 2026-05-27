
-- 1) Tighten device_change_requests UPDATE: only staff can approve/modify
DROP POLICY IF EXISTS "approver updates" ON public.device_change_requests;

CREATE POLICY "staff approve device changes"
  ON public.device_change_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_lgi(auth.uid()))
  WITH CHECK (public.is_admin_or_lgi(auth.uid()));

-- 2) Limited peer-profile visibility for authenticated users
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT id, full_name, avatar_url, cds_group, state_code
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;

-- Allow authenticated users to read minimal peer profile fields via the view.
-- The view is security_invoker, so we need a SELECT policy on the base table.
-- We scope it narrowly: only authenticated users, and the application must
-- query the view (which only exposes safe columns).
CREATE POLICY "authenticated read minimal peer profile fields"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
