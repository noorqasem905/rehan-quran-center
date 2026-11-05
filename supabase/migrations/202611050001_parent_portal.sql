-- Parent Portal foundation.
-- Parent accounts must be Supabase Auth users; auth.uid() is the identity used by RLS.

ALTER TABLE public.app_users
  DROP CONSTRAINT IF EXISTS app_users_role_check;

ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('general_supervisor', 'class_supervisor', 'it_admin', 'parent'));

CREATE TABLE IF NOT EXISTS public.parent_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.parent_student (
  parent_id UUID NOT NULL REFERENCES public.parent_profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS parent_student_student_id_idx
  ON public.parent_student(student_id);

ALTER TABLE public.parent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parents read own profile" ON public.parent_profiles;
CREATE POLICY "Parents read own profile"
  ON public.parent_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() AND is_active = true);

DROP POLICY IF EXISTS "Parents read own student links" ON public.parent_student;
CREATE POLICY "Parents read own student links"
  ON public.parent_student
  FOR SELECT TO authenticated
  USING (
    parent_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.parent_profiles
      WHERE id = auth.uid() AND is_active = true
    )
  );

DROP FUNCTION IF EXISTS public.is_parent_of(UUID);
CREATE OR REPLACE FUNCTION public.is_parent_of(target_student UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.parent_student ps
    JOIN public.parent_profiles pp ON pp.id = ps.parent_id
    WHERE ps.parent_id = auth.uid()
      AND ps.student_id = target_student
      AND pp.is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_parent_of(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_parent_of(UUID) TO authenticated;

DROP POLICY IF EXISTS "Parents read linked students" ON public.students;
CREATE POLICY "Parents read linked students"
  ON public.students
  FOR SELECT TO authenticated
  USING (
    public.is_parent_of(id)
    AND status = 'approved'
    AND is_deleted = false
  );

DROP VIEW IF EXISTS public.parent_student_progress;
CREATE VIEW public.parent_student_progress
WITH (security_invoker = true)
AS
SELECT
  s.id AS student_id,
  s.name AS student_name,
  s.class_id,
  s.juz_memorized,
  s.attendance_records,
  s.passport_data
FROM public.students s
WHERE public.is_parent_of(s.id)
  AND s.status = 'approved'
  AND s.is_deleted = false;

GRANT SELECT ON public.parent_student_progress TO authenticated;

COMMENT ON TABLE public.parent_student IS
  'Links Supabase Auth parent accounts to the students they are allowed to view.';
