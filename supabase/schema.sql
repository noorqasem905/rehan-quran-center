CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  room TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 15 CHECK (capacity > 0),
  level TEXT NOT NULL DEFAULT 'تأسيسي',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE TABLE IF NOT EXISTS supervisors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('general_supervisor', 'class_supervisor', 'it_admin')),
  role_title TEXT NOT NULL,
  assigned_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  phone TEXT,
  national_id TEXT,
  qualification TEXT,
  specialty TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE supervisors
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE supervisors
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('general_supervisor', 'class_supervisor', 'it_admin')),
  supervisor_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct app user reads" ON app_users;
CREATE POLICY "No direct app user reads" ON app_users
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
  new_user public.app_users;
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
  VALUES (p_username, crypt(p_password, gen_salt('bf')), p_role, new_supervisor.id)
  RETURNING * INTO new_user;

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

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('approved', 'pending_approval', 'archived')),
  juz_memorized INTEGER NOT NULL DEFAULT 0 CHECK (juz_memorized BETWEEN 0 AND 30),
  guardian_phone TEXT NOT NULL,
  tuition_paid BOOLEAN NOT NULL DEFAULT false,
  tuition_amount NUMERIC NOT NULL DEFAULT 0 CHECK (tuition_amount >= 0),
  attendance_records JSONB NOT NULL DEFAULT '{}'::jsonb,
  passport_data JSONB DEFAULT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT approved_students_have_passport
    CHECK (status <> 'approved' OR passport_data IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS supervisor_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supervisor_id UUID NOT NULL REFERENCES supervisors(id) ON DELETE RESTRICT,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(supervisor_id, shift_date)
);

-- Preserve attendance history if this relationship is applied to an existing database.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'supervisor_shifts_supervisor_id_fkey'
      AND conrelid = 'public.supervisor_shifts'::regclass
  ) THEN
    ALTER TABLE supervisor_shifts
      DROP CONSTRAINT supervisor_shifts_supervisor_id_fkey;
  END IF;

  ALTER TABLE supervisor_shifts
    ADD CONSTRAINT supervisor_shifts_supervisor_id_fkey
    FOREIGN KEY (supervisor_id) REFERENCES supervisors(id) ON DELETE RESTRICT;
END $$;

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_shifts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_general_supervisor()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM supervisors
    WHERE user_id = auth.uid() AND role IN ('general_supervisor', 'it_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_class_supervisor_for(target_class UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM supervisors
    WHERE user_id = auth.uid()
      AND role = 'class_supervisor'
      AND assigned_class_id = target_class
  );
$$;

DROP POLICY IF EXISTS "Authenticated users read classes" ON classes;
CREATE POLICY "Authenticated users read classes" ON classes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "General supervisors manage classes" ON classes;
CREATE POLICY "General supervisors manage classes" ON classes
  FOR ALL TO authenticated USING (public.is_general_supervisor())
  WITH CHECK (public.is_general_supervisor());

DROP POLICY IF EXISTS "General supervisors manage supervisors" ON supervisors;
CREATE POLICY "General supervisors manage supervisors" ON supervisors
  FOR ALL TO authenticated USING (public.is_general_supervisor())
  WITH CHECK (public.is_general_supervisor());

DROP POLICY IF EXISTS "Supervisors read own profile" ON supervisors;
CREATE POLICY "Supervisors read own profile" ON supervisors
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.is_general_supervisor()
  );

DROP POLICY IF EXISTS "Supervisors read permitted students" ON students;
CREATE POLICY "Supervisors read permitted students" ON students
  FOR SELECT TO authenticated USING (
    public.is_general_supervisor()
    OR (status = 'approved' AND public.is_class_supervisor_for(class_id))
  );

DROP POLICY IF EXISTS "Class supervisors submit pending students" ON students;
CREATE POLICY "Class supervisors submit pending students" ON students
  FOR INSERT TO authenticated WITH CHECK (
    public.is_general_supervisor()
    OR (
      status = 'pending_approval'
      AND passport_data IS NULL
      AND tuition_paid = false
      AND tuition_amount = 0
      AND public.is_class_supervisor_for(class_id)
    )
  );

DROP POLICY IF EXISTS "Permitted supervisors update students" ON students;
CREATE POLICY "Permitted supervisors update students" ON students
  FOR UPDATE TO authenticated USING (
    public.is_general_supervisor()
    OR (status = 'approved' AND public.is_class_supervisor_for(class_id))
  ) WITH CHECK (
    public.is_general_supervisor()
    OR (status = 'approved' AND public.is_class_supervisor_for(class_id))
  );

DROP POLICY IF EXISTS "General supervisors delete students" ON students;
CREATE POLICY "General supervisors delete students" ON students
  FOR DELETE TO authenticated USING (public.is_general_supervisor());

DROP POLICY IF EXISTS "Supervisors manage own shifts" ON supervisor_shifts;
CREATE POLICY "Supervisors manage own shifts" ON supervisor_shifts
  FOR ALL TO authenticated USING (
    public.is_general_supervisor()
    OR supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
  ) WITH CHECK (
    public.is_general_supervisor()
    OR supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
  );
