-- Add parent_id column to comments for nested replies
ALTER TABLE public.comments 
ADD COLUMN parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

-- Create index for faster nested comment queries
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);

-- Add encrypted message fields to messages table for E2E encryption
ALTER TABLE public.messages 
ADD COLUMN encrypted_text text,
ADD COLUMN iv text,
ADD COLUMN sender_public_key text;

-- Add public key to profiles for E2E encryption key exchange
ALTER TABLE public.profiles
ADD COLUMN public_key text;