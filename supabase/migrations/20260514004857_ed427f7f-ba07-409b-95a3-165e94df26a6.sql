
-- Recreate handle_new_user trigger that was lost due to ALTER TYPE rollback
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chosen text;
  chosen_role public.app_role;
  has_active_lgi boolean;
  new_status public.approval_status;
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
  )
  ON CONFLICT (id) DO NOTHING;

  chosen := COALESCE(NEW.raw_user_meta_data->>'role', 'corps_member');
  IF chosen NOT IN ('corps_member','admin','lgi','media_editor','corporate_firm') THEN
    chosen := 'corps_member';
  END IF;
  chosen_role := chosen::public.app_role;

  IF chosen_role = 'corps_member' THEN
    new_status := 'approved';
  ELSIF chosen_role = 'lgi' THEN
    SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role='lgi' AND status='approved')
      INTO has_active_lgi;
    new_status := CASE WHEN has_active_lgi THEN 'pending'::public.approval_status ELSE 'approved'::public.approval_status END;
  ELSE
    new_status := 'pending';
  END IF;

  INSERT INTO public.user_roles(user_id, role, status)
  VALUES (NEW.id, chosen_role, new_status)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth users that are missing profile/role rows
INSERT INTO public.profiles (id, full_name, state_code, phone, portal_number, firm_company_name, num_staff, industry, applicant_role, csr_focus)
SELECT u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)),
  u.raw_user_meta_data->>'state_code',
  u.raw_user_meta_data->>'phone',
  u.raw_user_meta_data->>'portal_number',
  u.raw_user_meta_data->>'firm_company_name',
  NULLIF(u.raw_user_meta_data->>'num_staff','')::int,
  u.raw_user_meta_data->>'industry',
  u.raw_user_meta_data->>'applicant_role',
  u.raw_user_meta_data->>'csr_focus'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

INSERT INTO public.user_roles (user_id, role, status)
SELECT u.id,
  (CASE WHEN COALESCE(u.raw_user_meta_data->>'role','corps_member') IN ('corps_member','admin','lgi','media_editor','corporate_firm')
        THEN COALESCE(u.raw_user_meta_data->>'role','corps_member')
        ELSE 'corps_member' END)::public.app_role,
  (CASE
     WHEN COALESCE(u.raw_user_meta_data->>'role','corps_member') = 'corps_member' THEN 'approved'
     WHEN COALESCE(u.raw_user_meta_data->>'role','corps_member') = 'lgi'
          AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='lgi' AND status='approved') THEN 'approved'
     ELSE 'pending'
   END)::public.approval_status
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL;
