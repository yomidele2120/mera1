-- First create the update function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create call_logs table for storing call history
CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  call_type TEXT NOT NULL DEFAULT 'voice' CHECK (call_type IN ('voice', 'video')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ringing', 'ongoing', 'completed', 'missed', 'rejected', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own call logs
CREATE POLICY "Users can view their own call logs"
ON public.call_logs
FOR SELECT
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Users can create call logs as caller
CREATE POLICY "Users can create call logs as caller"
ON public.call_logs
FOR INSERT
WITH CHECK (auth.uid() = caller_id AND NOT is_blocked(caller_id, receiver_id));

-- Users can update call logs they're part of
CREATE POLICY "Users can update their call logs"
ON public.call_logs
FOR UPDATE
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Create indexes for performance
CREATE INDEX idx_call_logs_caller ON public.call_logs(caller_id);
CREATE INDEX idx_call_logs_receiver ON public.call_logs(receiver_id);
CREATE INDEX idx_call_logs_status ON public.call_logs(status);
CREATE INDEX idx_call_logs_created ON public.call_logs(created_at DESC);

-- Enable realtime for call_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;

-- Trigger for updating timestamps
CREATE TRIGGER update_call_logs_updated_at
BEFORE UPDATE ON public.call_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();