CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('general_supervisor', 'class_supervisor', 'it_admin')),
  supervisor_id UUID REFERENCES public.supervisors(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct app user reads" ON public.app_users;
CREATE POLICY "No direct app user reads" ON public.app_users
  FOR SELECT TO anon, authenticated USING (false);

DROP FUNCTION IF EXISTS public.verify_app_user(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.verify_app_user(
  p_username TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  matched_user RECORD;
BEGIN
  SELECT
    u.id,
    u.username,
    u.role,
    u.supervisor_id,
    s.name,
    s.role_title,
    s.assigned_class_id
  INTO matched_user
  FROM public.app_users u
  LEFT JOIN public.supervisors s ON s.id = u.supervisor_id
  WHERE lower(u.username) = lower(p_username)
    AND u.is_active = true
    AND u.password_hash = crypt(p_password, u.password_hash)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', matched_user.id,
    'username', matched_user.username,
    'role', matched_user.role,
    'supervisor_id', matched_user.supervisor_id,
    'name', COALESCE(matched_user.name, ''),
    'role_title', COALESCE(matched_user.role_title, 'المشرف العام'),
    'assigned_class_id', matched_user.assigned_class_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_app_user(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_app_user(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_new_supervisor(
  p_name TEXT,
  p_username TEXT,
  p_password TEXT,
  p_role TEXT,
  p_role_title TEXT,
  p_class_id UUID,
  p_phone TEXT DEFAULT NULL,
  p_national_id TEXT DEFAULT NULL,
  p_qualification TEXT DEFAULT NULL,
  p_specialty TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  new_supervisor public.supervisors;
BEGIN
  IF p_username IS NULL OR p_username !~ '^[A-Za-z0-9._-]+$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'اسم المستخدم غير صالح.');
  END IF;
  IF length(COALESCE(p_password, '')) < 8 THEN
    RETURN jsonb_build_object('success', false, 'message', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_users WHERE lower(username) = lower(p_username)) THEN
    RETURN jsonb_build_object('success', false, 'message', 'اسم المستخدم محجوز.');
  END IF;

  INSERT INTO public.supervisors (
    name, role, role_title, assigned_class_id, phone, national_id, qualification, specialty
  ) VALUES (
    p_name, p_role, p_role_title, p_class_id, p_phone, p_national_id, p_qualification, p_specialty
  )
  RETURNING * INTO new_supervisor;

  INSERT INTO public.app_users (username, password_hash, role, supervisor_id)
  VALUES (p_username, crypt(p_password, gen_salt('bf')), p_role, new_supervisor.id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم إنشاء المشرف بنجاح.',
    'supervisor', to_jsonb(new_supervisor)
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'message', 'اسم المستخدم محجوز.');
END;
$$;

REVOKE ALL ON FUNCTION public.register_new_supervisor(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_new_supervisor(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;
