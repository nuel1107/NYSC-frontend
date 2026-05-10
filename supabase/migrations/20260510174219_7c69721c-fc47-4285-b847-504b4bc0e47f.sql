
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('corps_member', 'admin', 'lgi', 'media_editor');
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role AND status='approved');
$$;

CREATE OR REPLACE FUNCTION public.is_lgi(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'lgi');
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_lgi(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin') OR public.has_role(_user_id,'lgi');
$$;

CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "lgi view all roles" ON public.user_roles FOR SELECT USING (public.is_lgi(auth.uid()));
CREATE POLICY "lgi manage roles" ON public.user_roles FOR ALL USING (public.is_lgi(auth.uid())) WITH CHECK (public.is_lgi(auth.uid()));
CREATE POLICY "users insert own pending role" ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid()=user_id AND status='pending');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  state_code text,
  phone text,
  batch text,
  stream text,
  cds_group text,
  avatar_url text,
  device_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own profile" ON public.profiles FOR SELECT USING (auth.uid()=id);
CREATE POLICY "staff view all profiles" ON public.profiles FOR SELECT USING (public.is_admin_or_lgi(auth.uid()));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid()=id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid()=id);
CREATE POLICY "staff update profiles" ON public.profiles FOR UPDATE USING (public.is_admin_or_lgi(auth.uid()));

-- Auto-create profile + default corps_member (approved) on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, state_code, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'state_code',
    NEW.raw_user_meta_data->>'phone'
  );
  -- Default everyone to corps_member, approved. Admin/LGI requests are inserted separately.
  INSERT INTO public.user_roles(user_id, role, status)
  VALUES (NEW.id, 'corps_member', 'approved');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ QR EVENTS + ATTENDANCE ============
CREATE TABLE public.qr_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  code text NOT NULL UNIQUE,
  rotates_at timestamptz NOT NULL DEFAULT now() + interval '60 seconds',
  expires_at timestamptz NOT NULL DEFAULT now() + interval '8 hours',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qr_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "everyone authed can read active qr" ON public.qr_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage qr" ON public.qr_events FOR ALL USING (public.is_admin_or_lgi(auth.uid())) WITH CHECK (public.is_admin_or_lgi(auth.uid()));

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES public.qr_events(id) ON DELETE CASCADE NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own attendance" ON public.attendance FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "staff view all attendance" ON public.attendance FOR SELECT USING (public.is_admin_or_lgi(auth.uid()));
CREATE POLICY "users record own attendance" ON public.attendance FOR INSERT WITH CHECK (auth.uid()=user_id);

-- ============ ABSENCE REQUESTS ============
CREATE TABLE public.absence_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  attachment_url text,
  status approval_status NOT NULL DEFAULT 'pending',
  reviewer_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.absence_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own absence" ON public.absence_requests FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "staff view all absence" ON public.absence_requests FOR SELECT USING (public.is_admin_or_lgi(auth.uid()));
CREATE POLICY "users create own absence" ON public.absence_requests FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "staff update absence" ON public.absence_requests FOR UPDATE USING (public.is_admin_or_lgi(auth.uid()));
CREATE TRIGGER absence_touch BEFORE UPDATE ON public.absence_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ COMMUNITY POSTS ============
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed view posts" ON public.community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "users create own posts" ON public.community_posts FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "users delete own posts" ON public.community_posts FOR DELETE USING (auth.uid()=user_id OR public.is_admin_or_lgi(auth.uid()));

-- ============ NEWS HOUSE ============
CREATE TABLE public.news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  excerpt text,
  body text NOT NULL,
  cover_url text,
  published boolean NOT NULL DEFAULT false,
  author_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published news" ON public.news_articles FOR SELECT USING (published=true);
CREATE POLICY "staff read all news" ON public.news_articles FOR SELECT USING (public.is_admin_or_lgi(auth.uid()) OR public.has_role(auth.uid(),'media_editor'));
CREATE POLICY "editors manage news" ON public.news_articles FOR ALL
  USING (public.is_admin_or_lgi(auth.uid()) OR public.has_role(auth.uid(),'media_editor'))
  WITH CHECK (public.is_admin_or_lgi(auth.uid()) OR public.has_role(auth.uid(),'media_editor'));
CREATE TRIGGER news_touch BEFORE UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ IMPACT METRICS ============
CREATE TABLE public.impact_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL UNIQUE,
  label text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  unit text,
  display_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.impact_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read metrics" ON public.impact_metrics FOR SELECT USING (true);
CREATE POLICY "staff manage metrics" ON public.impact_metrics FOR ALL USING (public.is_admin_or_lgi(auth.uid())) WITH CHECK (public.is_admin_or_lgi(auth.uid()));
CREATE TRIGGER metrics_touch BEFORE UPDATE ON public.impact_metrics
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed metrics
INSERT INTO public.impact_metrics(metric_key,label,value,unit,display_order) VALUES
('corps_deployed','Corps Members Deployed',0,'',1),
('funds_generated','Funds Generated',0,'NGN',2),
('beneficiaries','Community Beneficiaries',0,'',3),
('saed_trained','SAED Trained',0,'',4);

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_global boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see their notifications" ON public.notifications FOR SELECT
  USING (is_global=true OR target_user_id=auth.uid() OR public.is_admin_or_lgi(auth.uid()));
CREATE POLICY "staff create notifications" ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin_or_lgi(auth.uid()));

CREATE TABLE public.notification_reads (
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own reads" ON public.notification_reads FOR ALL
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============ STORAGE ============
INSERT INTO storage.buckets (id,name,public) VALUES ('absence-attachments','absence-attachments',false);
INSERT INTO storage.buckets (id,name,public) VALUES ('news-media','news-media',true);
INSERT INTO storage.buckets (id,name,public) VALUES ('community-media','community-media',true);

CREATE POLICY "users upload own absence files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='absence-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users read own absence files" ON storage.objects FOR SELECT
  USING (bucket_id='absence-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_lgi(auth.uid())));

CREATE POLICY "public read news media" ON storage.objects FOR SELECT USING (bucket_id='news-media');
CREATE POLICY "editors upload news media" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='news-media' AND (public.is_admin_or_lgi(auth.uid()) OR public.has_role(auth.uid(),'media_editor')));

CREATE POLICY "public read community media" ON storage.objects FOR SELECT USING (bucket_id='community-media');
CREATE POLICY "users upload community media" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='community-media' AND auth.uid()::text = (storage.foldername(name))[1]);
