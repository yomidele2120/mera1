-- Create a separate table for signup verification codes (before user exists)
CREATE TABLE IF NOT EXISTS public.signup_verification_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  used BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on email for upsert
CREATE UNIQUE INDEX IF NOT EXISTS signup_verification_codes_email_idx ON public.signup_verification_codes (email);

-- Enable RLS
ALTER TABLE public.signup_verification_codes ENABLE ROW LEVEL SECURITY;

-- No direct access policy - only edge functions with service role can access
-- This is intentional for security