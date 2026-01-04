-- Create table for password reset verification codes
CREATE TABLE public.password_reset_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  used BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own codes (for verification)
CREATE POLICY "Users can read their own verification codes" 
ON public.password_reset_codes 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_password_reset_codes_email ON public.password_reset_codes(email);
CREATE INDEX idx_password_reset_codes_user_id ON public.password_reset_codes(user_id);

-- Function to check rate limiting for password reset requests
CREATE OR REPLACE FUNCTION public.check_password_reset_rate_limit(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.password_reset_codes
  WHERE email = p_email
    AND created_at > (now() - interval '1 hour');
  
  RETURN recent_count < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to verify OTP code
CREATE OR REPLACE FUNCTION public.verify_password_reset_code(p_email TEXT, p_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_record RECORD;
  v_result JSON;
BEGIN
  -- Find the most recent unused code for this email
  SELECT * INTO v_record
  FROM public.password_reset_codes
  WHERE email = p_email
    AND used = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'No valid verification code found');
  END IF;
  
  -- Check attempts
  IF v_record.attempts >= 5 THEN
    UPDATE public.password_reset_codes SET used = true WHERE id = v_record.id;
    RETURN json_build_object('success', false, 'error', 'Too many attempts. Please request a new code.');
  END IF;
  
  -- Increment attempts
  UPDATE public.password_reset_codes 
  SET attempts = attempts + 1 
  WHERE id = v_record.id;
  
  -- Check if code matches
  IF v_record.code = p_code THEN
    UPDATE public.password_reset_codes SET used = true WHERE id = v_record.id;
    RETURN json_build_object('success', true, 'user_id', v_record.user_id);
  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid verification code');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;