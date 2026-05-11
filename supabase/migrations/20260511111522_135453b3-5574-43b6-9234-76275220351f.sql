
-- =========================================================
-- WAVE 1: FOUNDATION
-- =========================================================

-- 1. Add corporate_firm role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'corporate_firm';

-- 2. Profile fields for dynamic registration
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portal_number text,
  ADD COLUMN IF NOT EXISTS firm_company_name text,
  ADD COLUMN IF NOT EXISTS num_staff integer,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS applicant_role text,
  ADD COLUMN IF NOT EXISTS csr_focus text;

-- 3. Singleton LGI: only one approved LGI at a time
CREATE UNIQUE INDEX IF NOT EXISTS one_active_lgi
  ON public.user_roles ((true))
  WHERE role = 'lgi' AND status = 'approved';

-- 4. Replace handle_new_user trigger: respect chosen role + LGI singleton
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chosen text;
  chosen_role app_role;
  has_active_lgi boolean;
  new_status approval_status;
BEGIN
  INSERT INTO public.profiles (
    id, full_name, state_code, phone,
    portal_number, firm_company_name, num_staff, industry, applicant_role, csr_focus
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'state_code',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'portal_number',
    NEW.raw_user_meta_data->>'firm_company_name',
    NULLIF(NEW.raw_user_meta_data->>'num_staff','')::int,
    NEW.raw_user_meta_data->>'industry',
    NEW.raw_user_meta_data->>'applicant_role',
    NEW.raw_user_meta_data->>'csr_focus'
  );

  chosen := COALESCE(NEW.raw_user_meta_data->>'role', 'corps_member');
  IF chosen NOT IN ('corps_member','admin','lgi','media_editor','corporate_firm') THEN
    chosen := 'corps_member';
  END IF;
  chosen_role := chosen::app_role;

  IF chosen_role = 'corps_member' THEN
    new_status := 'approved';
  ELSIF chosen_role = 'lgi' THEN
    SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role='lgi' AND status='approved')
      INTO has_active_lgi;
    new_status := CASE WHEN has_active_lgi THEN 'pending'::approval_status ELSE 'approved'::approval_status END;
  ELSE
    new_status := 'pending';
  END IF;

  INSERT INTO public.user_roles(user_id, role, status)
  VALUES (NEW.id, chosen_role, new_status);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. DEVICE BINDING
CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fingerprint text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_device_per_user
  ON public.user_devices(user_id) WHERE is_active = true;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own devices" ON public.user_devices FOR SELECT USING (auth.uid()=user_id OR public.is_admin_or_lgi(auth.uid()));
CREATE POLICY "users insert own device" ON public.user_devices FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "staff manage devices" ON public.user_devices FOR UPDATE USING (public.is_admin_or_lgi(auth.uid()) OR auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS public.device_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  new_fingerprint text NOT NULL,
  new_label text,
  reason text NOT NULL,
  path text NOT NULL DEFAULT 'old_device', -- 'old_device' | 'admin'
  status approval_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE public.device_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user own change reqs" ON public.device_change_requests FOR SELECT USING (auth.uid()=user_id OR public.is_admin_or_lgi(auth.uid()));
CREATE POLICY "user create change req" ON public.device_change_requests FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "approver updates" ON public.device_change_requests FOR UPDATE USING (public.is_admin_or_lgi(auth.uid()) OR auth.uid()=user_id);

-- 6. EVENTS (replaces qr_events) + GEOFENCED ATTENDANCE
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.qr_events CASCADE;

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_m integer NOT NULL DEFAULT 100,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  attendance_locked boolean NOT NULL DEFAULT false,
  locked_by_role app_role,        -- which role applied the lock
  locked_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed read events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage events" ON public.events FOR ALL USING (public.is_admin_or_lgi(auth.uid())) WITH CHECK (public.is_admin_or_lgi(auth.uid()));
CREATE TRIGGER tg_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.event_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  clock_in_at timestamptz,
  clock_in_lat double precision,
  clock_in_lng double precision,
  clock_out_at timestamptz,
  clock_out_lat double precision,
  clock_out_lng double precision,
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user own attendance" ON public.event_attendance FOR SELECT USING (auth.uid()=user_id OR public.is_admin_or_lgi(auth.uid()));
CREATE POLICY "user clock in" ON public.event_attendance FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "user clock out" ON public.event_attendance FOR UPDATE USING (auth.uid()=user_id OR public.is_admin_or_lgi(auth.uid()));

-- Lock/unlock helper enforcing LGI > admin
CREATE OR REPLACE FUNCTION public.set_event_lock(_event_id uuid, _lock boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role app_role;
  caller_is_lgi boolean;
  caller_is_admin boolean;
BEGIN
  caller_is_lgi := public.has_role(auth.uid(),'lgi');
  caller_is_admin := public.has_role(auth.uid(),'admin');
  IF NOT (caller_is_lgi OR caller_is_admin) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT locked_by_role INTO current_role FROM public.events WHERE id=_event_id;
  -- Admins cannot override an LGI lock
  IF current_role = 'lgi' AND NOT caller_is_lgi THEN
    RAISE EXCEPTION 'Locked by LGI; only LGI can change this';
  END IF;

  UPDATE public.events
  SET attendance_locked = _lock,
      locked_by_role = CASE WHEN _lock THEN (CASE WHEN caller_is_lgi THEN 'lgi'::app_role ELSE 'admin'::app_role END) ELSE NULL END,
      locked_by = CASE WHEN _lock THEN auth.uid() ELSE NULL END
  WHERE id=_event_id;
END;
$$;

-- 7. COMPLAINTS
CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  attachment_url text,
  status approval_status NOT NULL DEFAULT 'pending',
  reviewer_note text,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own complaints" ON public.complaints FOR SELECT USING (auth.uid()=user_id OR public.is_admin_or_lgi(auth.uid()));
CREATE POLICY "users create complaint" ON public.complaints FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "staff update complaint" ON public.complaints FOR UPDATE USING (public.is_admin_or_lgi(auth.uid()));
CREATE TRIGGER tg_complaints_updated BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. IMPACT METRICS AUDIT LOG (LGI only readable)
CREATE TABLE public.impact_metric_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  old_value numeric,
  new_value numeric,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.impact_metric_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lgi read audit" ON public.impact_metric_changes FOR SELECT USING (public.is_lgi(auth.uid()));
CREATE POLICY "staff write audit" ON public.impact_metric_changes FOR INSERT WITH CHECK (public.is_admin_or_lgi(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_impact_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.impact_metric_changes(metric_id, changed_by, old_value, new_value)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.id), OLD.value, NEW.value);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_impact_change ON public.impact_metrics;
CREATE TRIGGER tg_impact_change AFTER UPDATE ON public.impact_metrics FOR EACH ROW EXECUTE FUNCTION public.log_impact_change();

-- 9. CORPORATE FIRMS
CREATE TABLE public.corporate_firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  company_name text NOT NULL,
  email text NOT NULL,
  phone text,
  num_staff integer,
  industry text,
  applicant_role text,
  csr_focus text,
  status approval_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.corporate_firms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read firm" ON public.corporate_firms FOR SELECT USING (auth.uid()=owner_id OR public.is_admin_or_lgi(auth.uid()));
CREATE POLICY "owner insert firm" ON public.corporate_firms FOR INSERT WITH CHECK (auth.uid()=owner_id);
CREATE POLICY "owner update firm" ON public.corporate_firms FOR UPDATE USING (auth.uid()=owner_id OR public.is_admin_or_lgi(auth.uid()));
CREATE TRIGGER tg_firms_updated BEFORE UPDATE ON public.corporate_firms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.firm_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.corporate_firms(id) ON DELETE CASCADE,
  doc_name text NOT NULL,
  url text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.firm_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm docs read" ON public.firm_documents FOR SELECT USING (
  public.is_admin_or_lgi(auth.uid()) OR EXISTS (SELECT 1 FROM public.corporate_firms f WHERE f.id=firm_id AND f.owner_id=auth.uid())
);
CREATE POLICY "firm docs insert" ON public.firm_documents FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.corporate_firms f WHERE f.id=firm_id AND f.owner_id=auth.uid())
);

CREATE TABLE public.job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.corporate_firms(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  job_type text NOT NULL DEFAULT 'full_time', -- 'full_time' | 'internship'
  location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed read jobs" ON public.job_postings FOR SELECT TO authenticated USING (is_active = true OR public.is_admin_or_lgi(auth.uid()) OR EXISTS (SELECT 1 FROM public.corporate_firms f WHERE f.id=firm_id AND f.owner_id=auth.uid()));
CREATE POLICY "firm manage jobs" ON public.job_postings FOR ALL USING (
  public.is_admin_or_lgi(auth.uid()) OR EXISTS (SELECT 1 FROM public.corporate_firms f WHERE f.id=firm_id AND f.owner_id=auth.uid() AND f.status='approved')
) WITH CHECK (
  public.is_admin_or_lgi(auth.uid()) OR EXISTS (SELECT 1 FROM public.corporate_firms f WHERE f.id=firm_id AND f.owner_id=auth.uid() AND f.status='approved')
);
CREATE TRIGGER tg_jobs_updated BEFORE UPDATE ON public.job_postings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 10. SAED 2.0
CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed read skills" ON public.skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage skills" ON public.skills FOR ALL USING (public.is_admin_or_lgi(auth.uid())) WITH CHECK (public.is_admin_or_lgi(auth.uid()));

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  resource_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed read courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage courses" ON public.courses FOR ALL USING (public.is_admin_or_lgi(auth.uid())) WITH CHECK (public.is_admin_or_lgi(auth.uid()));

CREATE TABLE public.tutor_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  pitch text NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill_id)
);
ALTER TABLE public.tutor_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user own tutor app" ON public.tutor_applications FOR SELECT USING (auth.uid()=user_id OR public.is_admin_or_lgi(auth.uid()));
CREATE POLICY "user create tutor app" ON public.tutor_applications FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "staff update tutor" ON public.tutor_applications FOR UPDATE USING (public.is_admin_or_lgi(auth.uid()));

-- 11. CLUBS
CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  cover_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed read clubs" ON public.clubs FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage clubs" ON public.clubs FOR ALL USING (public.is_admin_or_lgi(auth.uid())) WITH CHECK (public.is_admin_or_lgi(auth.uid()));

CREATE TABLE public.club_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, user_id)
);
ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user read own membership" ON public.club_memberships FOR SELECT USING (auth.uid()=user_id OR public.is_admin_or_lgi(auth.uid()));
CREATE POLICY "user join club" ON public.club_memberships FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "staff manage memberships" ON public.club_memberships FOR UPDATE USING (public.is_admin_or_lgi(auth.uid()));
CREATE POLICY "user leaves club" ON public.club_memberships FOR DELETE USING (auth.uid()=user_id OR public.is_admin_or_lgi(auth.uid()));

-- 12. CDS RANKINGS (monthly)
CREATE TABLE public.cds_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_year integer NOT NULL,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  rank integer NOT NULL,
  cds_group text NOT NULL,
  notes text,
  benefits text,                 -- shown to #1
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(period_year, period_month, rank)
);
ALTER TABLE public.cds_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed read rankings" ON public.cds_rankings FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage rankings" ON public.cds_rankings FOR ALL USING (public.is_admin_or_lgi(auth.uid())) WITH CHECK (public.is_admin_or_lgi(auth.uid()));

-- 13. Storage buckets for new modules
INSERT INTO storage.buckets (id, name, public) VALUES ('firm-documents','firm-documents', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('complaint-attachments','complaint-attachments', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "firm doc owner read" ON storage.objects FOR SELECT USING (
  bucket_id='firm-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid()))
);
CREATE POLICY "firm doc owner upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id='firm-documents' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "complaint owner read" ON storage.objects FOR SELECT USING (
  bucket_id='complaint-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid()))
);
CREATE POLICY "complaint owner upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id='complaint-attachments' AND auth.uid()::text = (storage.foldername(name))[1]
);
