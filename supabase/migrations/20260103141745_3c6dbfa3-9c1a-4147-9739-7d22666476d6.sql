-- Drop the problematic check constraint that's blocking encrypted messages
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS has_content;

-- Add a more flexible check that allows encrypted_text OR text OR media_url
ALTER TABLE public.messages ADD CONSTRAINT has_content 
  CHECK (text IS NOT NULL OR media_url IS NOT NULL OR encrypted_text IS NOT NULL);