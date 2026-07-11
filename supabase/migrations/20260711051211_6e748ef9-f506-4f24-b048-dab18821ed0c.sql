DROP TABLE IF EXISTS public.calls CASCADE;

CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  caller_id uuid NOT NULL,
  caller_name text NOT NULL,
  callee_id uuid NOT NULL,
  call_type text NOT NULL DEFAULT 'video',
  status text NOT NULL DEFAULT 'ringing',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caller can insert"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "participants can read"
  ON public.calls FOR SELECT
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "participants can update"
  ON public.calls FOR UPDATE
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE INDEX idx_calls_callee_created ON public.calls(callee_id, created_at DESC);
CREATE INDEX idx_calls_caller_created ON public.calls(caller_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;