
-- =========================================================================
-- 1) DEVICE BINDING: prevent self-update of device rows
-- =========================================================================
DROP POLICY IF EXISTS "staff manage devices" ON public.user_devices;

-- Only admins/LGI can directly UPDATE device rows (e.g., revoke/reassign).
CREATE POLICY "staff update devices"
ON public.user_devices
FOR UPDATE
USING (public.is_admin_or_lgi(auth.uid()))
WITH CHECK (public.is_admin_or_lgi(auth.uid()));

-- Safe helper: lets the owner touch only last_seen + label on their OWN
-- active device. Cannot flip is_active or rewrite the fingerprint.
CREATE OR REPLACE FUNCTION public.touch_own_device(_device_id uuid, _label text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.user_devices
     SET last_seen = now(),
         label     = COALESCE(_label, label)
   WHERE id        = _device_id
     AND user_id   = auth.uid()
     AND is_active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_own_device(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_own_device(uuid, text) TO authenticated;

-- =========================================================================
-- 2) ATTENDANCE: server-side geofence enforcement
-- =========================================================================
CREATE OR REPLACE FUNCTION public.enforce_event_geofence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_lat   double precision;
  ev_lng   double precision;
  ev_rad   integer;
  ev_locked boolean;
  lat      double precision;
  lng      double precision;
  dist_m   double precision;
BEGIN
  SELECT latitude, longitude, radius_m, attendance_locked
    INTO ev_lat, ev_lng, ev_rad, ev_locked
    FROM public.events WHERE id = NEW.event_id;

  IF ev_lat IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF ev_locked AND NOT public.is_admin_or_lgi(auth.uid()) THEN
    RAISE EXCEPTION 'Attendance is locked for this event';
  END IF;

  -- Pick the coordinates being written this op
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.clock_in_at IS DISTINCT FROM OLD.clock_in_at) THEN
    lat := NEW.clock_in_lat; lng := NEW.clock_in_lng;
  ELSIF TG_OP = 'UPDATE' AND NEW.clock_out_at IS DISTINCT FROM OLD.clock_out_at THEN
    lat := NEW.clock_out_lat; lng := NEW.clock_out_lng;
  ELSE
    RETURN NEW;
  END IF;

  IF lat IS NULL OR lng IS NULL THEN
    RAISE EXCEPTION 'Location required for attendance';
  END IF;

  -- Haversine distance in metres
  dist_m := 2 * 6371000 * asin(
    sqrt(
      sin(radians((lat - ev_lat) / 2)) ^ 2 +
      cos(radians(ev_lat)) * cos(radians(lat)) *
      sin(radians((lng - ev_lng) / 2)) ^ 2
    )
  );

  IF dist_m > ev_rad THEN
    RAISE EXCEPTION 'Outside event geofence (% m away, max %)', round(dist_m)::int, ev_rad;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_event_geofence ON public.event_attendance;
CREATE TRIGGER trg_enforce_event_geofence
BEFORE INSERT OR UPDATE ON public.event_attendance
FOR EACH ROW EXECUTE FUNCTION public.enforce_event_geofence();

-- =========================================================================
-- 3) USER_ROLES: prevent self-escalation to admin/lgi
-- =========================================================================
DROP POLICY IF EXISTS "users insert own pending role" ON public.user_roles;

CREATE POLICY "users insert own non-privileged pending role"
ON public.user_roles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND status  = 'pending'::public.approval_status
  AND role    IN ('corps_member'::public.app_role,
                  'media_editor'::public.app_role,
                  'corporate_firm'::public.app_role)
);

-- (Note: the handle_new_user trigger runs as SECURITY DEFINER and bypasses
-- this policy, so first-LGI bootstrap and the existing signup flow still work.)

-- =========================================================================
-- 4) PROFILES: drop unused, sensitive device_fingerprint column
-- =========================================================================
ALTER TABLE public.profiles DROP COLUMN IF EXISTS device_fingerprint;

-- =========================================================================
-- 5) STORAGE: add UPDATE/DELETE policies for every bucket
--    Convention: owner = first folder segment of object name (auth.uid()).
-- =========================================================================

-- absence-attachments (private, owner-scoped)
CREATE POLICY "absence owner update"  ON storage.objects FOR UPDATE
  USING  (bucket_id = 'absence-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid())))
  WITH CHECK (bucket_id = 'absence-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid())));
CREATE POLICY "absence owner delete"  ON storage.objects FOR DELETE
  USING  (bucket_id = 'absence-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid())));

-- complaint-attachments (private, owner-scoped)
CREATE POLICY "complaint owner update" ON storage.objects FOR UPDATE
  USING  (bucket_id = 'complaint-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid())))
  WITH CHECK (bucket_id = 'complaint-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid())));
CREATE POLICY "complaint owner delete" ON storage.objects FOR DELETE
  USING  (bucket_id = 'complaint-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid())));

-- firm-documents (private, owner-scoped via firm owner)
CREATE POLICY "firm docs owner update" ON storage.objects FOR UPDATE
  USING  (bucket_id = 'firm-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid())))
  WITH CHECK (bucket_id = 'firm-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid())));
CREATE POLICY "firm docs owner delete" ON storage.objects FOR DELETE
  USING  (bucket_id = 'firm-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid())));

-- news-media (public read, only editors/admins/LGI write)
CREATE POLICY "news media staff update" ON storage.objects FOR UPDATE
  USING  (bucket_id = 'news-media' AND (public.is_admin_or_lgi(auth.uid()) OR public.has_role(auth.uid(), 'media_editor'::public.app_role)))
  WITH CHECK (bucket_id = 'news-media' AND (public.is_admin_or_lgi(auth.uid()) OR public.has_role(auth.uid(), 'media_editor'::public.app_role)));
CREATE POLICY "news media staff delete" ON storage.objects FOR DELETE
  USING  (bucket_id = 'news-media' AND (public.is_admin_or_lgi(auth.uid()) OR public.has_role(auth.uid(), 'media_editor'::public.app_role)));

-- community-media (public read, owner can modify own uploads)
CREATE POLICY "community media owner update" ON storage.objects FOR UPDATE
  USING  (bucket_id = 'community-media' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid())))
  WITH CHECK (bucket_id = 'community-media' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid())));
CREATE POLICY "community media owner delete" ON storage.objects FOR DELETE
  USING  (bucket_id = 'community-media' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid())));

-- =========================================================================
-- 6) FUNCTION HARDENING
-- =========================================================================
-- Pin search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Revoke direct EXECUTE on internal helpers from anon/authenticated.
-- They remain callable inside RLS policies because policies run with
-- the policy owner's privileges, not the caller's.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)      FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_lgi(uuid)                          FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_lgi(uuid)                 FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_impact_change()                   FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at()                    FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                     FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_event_geofence()              FROM anon, authenticated, PUBLIC;

-- set_event_lock IS user-callable (lock/unlock from staff UIs)
GRANT EXECUTE ON FUNCTION public.set_event_lock(uuid, boolean) TO authenticated;
