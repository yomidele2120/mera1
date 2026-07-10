CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_name text NOT NULL,
  call_type text NOT NULL DEFAULT 'voice',
  status text NOT NULL DEFAULT 'pending',
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  duration_seconds integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "caller can insert" ON public.calls;
DROP POLICY IF EXISTS "participants can read" ON public.calls;
DROP POLICY IF EXISTS "participants can update" ON public.calls;
DROP POLICY IF EXISTS "Users can create calls as caller" ON public.calls;
DROP POLICY IF EXISTS "Users can view participant calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update participant calls" ON public.calls;

CREATE POLICY "caller can insert" ON public.calls
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = caller_id AND NOT public.is_blocked(caller_id, callee_id));

CREATE POLICY "participants can read" ON public.calls
FOR SELECT TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "participants can update" ON public.calls
FOR UPDATE TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id)
WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE INDEX IF NOT EXISTS idx_calls_caller ON public.calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON public.calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_created ON public.calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_callee_status_created ON public.calls(callee_id, status, created_at DESC);

DROP TRIGGER IF EXISTS update_calls_updated_at ON public.calls;
CREATE TRIGGER update_calls_updated_at
BEFORE UPDATE ON public.calls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication p
    JOIN pg_publication_rel pr ON pr.prpubid = p.oid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;
END $$;