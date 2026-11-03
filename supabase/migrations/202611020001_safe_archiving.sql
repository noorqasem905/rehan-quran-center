-- Run this migration once in the Supabase SQL Editor.
-- It preserves students, supervisors, classes, and attendance history when
-- an item is moved to the trash.

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.supervisors
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.supervisors
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'supervisor_shifts_supervisor_id_fkey'
      AND conrelid = 'public.supervisor_shifts'::regclass
  ) THEN
    ALTER TABLE public.supervisor_shifts
      DROP CONSTRAINT supervisor_shifts_supervisor_id_fkey;
  END IF;

  ALTER TABLE public.supervisor_shifts
    ADD CONSTRAINT supervisor_shifts_supervisor_id_fkey
    FOREIGN KEY (supervisor_id)
    REFERENCES public.supervisors(id)
    ON DELETE RESTRICT;
END $$;

DROP POLICY IF EXISTS "Supervisors read own profile" ON public.supervisors;
CREATE POLICY "Supervisors read own profile" ON public.supervisors
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.is_general_supervisor()
  );
