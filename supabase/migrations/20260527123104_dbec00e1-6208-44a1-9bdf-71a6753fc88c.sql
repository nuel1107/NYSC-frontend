
CREATE OR REPLACE FUNCTION public.lgi_assign_role(_user_id uuid, _role public.app_role, _status public.approval_status DEFAULT 'approved')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_lgi(auth.uid()) THEN
    RAISE EXCEPTION 'Only LGI can assign roles';
  END IF;

  INSERT INTO public.user_roles(user_id, role, status)
  VALUES (_user_id, _role, _status)
  ON CONFLICT (user_id, role) DO UPDATE SET status = EXCLUDED.status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lgi_assign_role(uuid, public.app_role, public.approval_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lgi_assign_role(uuid, public.app_role, public.approval_status) TO authenticated;

CREATE OR REPLACE FUNCTION public.lgi_remove_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_lgi(auth.uid()) THEN
    RAISE EXCEPTION 'Only LGI can remove roles';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lgi_remove_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lgi_remove_role(uuid, public.app_role) TO authenticated;
