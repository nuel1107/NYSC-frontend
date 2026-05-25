CREATE OR REPLACE FUNCTION public.ensure_user_portal_records()
RETURNS TABLE(role public.app_role, status public.approval_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  email text;
  meta jsonb;
  chosen text;
  chosen_role public.app_role;
  has_active_lgi boolean;
  new_status public.approval_status;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT u.email, COALESCE(u.raw_user_meta_data, '{}'::jsonb)
    INTO email, meta
    FROM auth.users u
   WHERE u.id = uid;

  IF email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, state_code, phone,
    portal_number, firm_company_name, num_staff, industry, applicant_role, csr_focus
  )
  VALUES (
    uid,
    COALESCE(NULLIF(meta->>'full_name', ''), split_part(email, '@', 1)),
    NULLIF(meta->>'state_code', ''),
    NULLIF(meta->>'phone', ''),
    NULLIF(meta->>'portal_number', ''),
    NULLIF(meta->>'firm_company_name', ''),
    NULLIF(meta->>'num_staff', '')::int,
    NULLIF(meta->>'industry', ''),
    NULLIF(meta->>'applicant_role', ''),
    NULLIF(meta->>'csr_focus', '')
  )
  ON CONFLICT (id) DO NOTHING;

  chosen := COALESCE(NULLIF(meta->>'role', ''), 'corps_member');
  IF chosen NOT IN ('corps_member','admin','lgi','media_editor','corporate_firm') THEN
    chosen := 'corps_member';
  END IF;
  chosen_role := chosen::public.app_role;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = uid AND ur.role = chosen_role
  ) THEN
    IF chosen_role = 'corps_member' THEN
      new_status := 'approved'::public.approval_status;
    ELSIF chosen_role = 'lgi' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.role = 'lgi'::public.app_role
          AND ur.status = 'approved'::public.approval_status
          AND ur.user_id <> uid
      ) INTO has_active_lgi;
      new_status := CASE
        WHEN has_active_lgi THEN 'pending'::public.approval_status
        ELSE 'approved'::public.approval_status
      END;
    ELSE
      new_status := 'pending'::public.approval_status;
    END IF;

    INSERT INTO public.user_roles(user_id, role, status)
    VALUES (uid, chosen_role, new_status);
  END IF;

  RETURN QUERY
  SELECT ur.role, ur.status
  FROM public.user_roles ur
  WHERE ur.user_id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_portal_records() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_portal_records() TO authenticated;

INSERT INTO public.profiles (
  id, full_name, state_code, phone,
  portal_number, firm_company_name, num_staff, industry, applicant_role, csr_focus
)
SELECT
  u.id,
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
  NULLIF(u.raw_user_meta_data->>'state_code', ''),
  NULLIF(u.raw_user_meta_data->>'phone', ''),
  NULLIF(u.raw_user_meta_data->>'portal_number', ''),
  NULLIF(u.raw_user_meta_data->>'firm_company_name', ''),
  NULLIF(u.raw_user_meta_data->>'num_staff', '')::int,
  NULLIF(u.raw_user_meta_data->>'industry', ''),
  NULLIF(u.raw_user_meta_data->>'applicant_role', ''),
  NULLIF(u.raw_user_meta_data->>'csr_focus', '')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

WITH chosen AS (
  SELECT
    u.id AS user_id,
    CASE
      WHEN COALESCE(NULLIF(u.raw_user_meta_data->>'role', ''), 'corps_member') IN ('corps_member','admin','lgi','media_editor','corporate_firm')
      THEN COALESCE(NULLIF(u.raw_user_meta_data->>'role', ''), 'corps_member')::public.app_role
      ELSE 'corps_member'::public.app_role
    END AS role,
    u.created_at
  FROM auth.users u
), ranked AS (
  SELECT *, row_number() OVER (PARTITION BY role ORDER BY created_at) AS role_rank
  FROM chosen
), final_roles AS (
  SELECT
    user_id,
    role,
    CASE
      WHEN role = 'corps_member'::public.app_role THEN 'approved'::public.approval_status
      WHEN role = 'lgi'::public.app_role AND role_rank = 1 THEN 'approved'::public.approval_status
      ELSE 'pending'::public.approval_status
    END AS status
  FROM ranked
)
INSERT INTO public.user_roles(user_id, role, status)
SELECT user_id, role, status
FROM final_roles fr
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = fr.user_id AND ur.role = fr.role
);