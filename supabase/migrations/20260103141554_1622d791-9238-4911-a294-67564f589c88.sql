-- Add unique user number and last_active_at to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_number BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create a sequence for user numbers starting at 100000000 (9 digits)
CREATE SEQUENCE IF NOT EXISTS user_number_seq START 100000000;

-- Create function to generate unique user number on profile creation
CREATE OR REPLACE FUNCTION public.generate_user_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_number IS NULL THEN
    NEW.user_number := nextval('user_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for new profiles
DROP TRIGGER IF EXISTS set_user_number ON public.profiles;
CREATE TRIGGER set_user_number
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_user_number();

-- Update existing profiles without user numbers
UPDATE public.profiles 
SET user_number = nextval('user_number_seq')
WHERE user_number IS NULL;

-- Create blocked_users table
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Enable RLS on blocked_users
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Policies for blocked_users
CREATE POLICY "Users can view their own blocks" ON public.blocked_users
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others" ON public.blocked_users
  FOR INSERT WITH CHECK (auth.uid() = blocker_id AND auth.uid() != blocked_id);

CREATE POLICY "Users can unblock" ON public.blocked_users
  FOR DELETE USING (auth.uid() = blocker_id);

-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  reported_message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policies for reports
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- Create function to update last_active_at
CREATE OR REPLACE FUNCTION public.update_last_active()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET last_active_at = now()
  WHERE id = auth.uid();
END;
$$;

-- Create function to check if user is blocked
CREATE OR REPLACE FUNCTION public.is_blocked(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  )
$$;

-- Create index for fast user number lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_number ON public.profiles(user_number);

-- Create index for blocked users lookups
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);

-- Create index for last_active_at
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at);

-- Enable realtime for blocked_users
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_users;