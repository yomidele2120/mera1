-- Add post_type column to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'image',
ADD COLUMN IF NOT EXISTS text_content TEXT;

-- Add message_type column to messages table  
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text';

-- Add chat_background_url to profiles for custom chat backgrounds
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS chat_background_url TEXT;

-- Create typing_status table for real-time typing indicators
CREATE TABLE IF NOT EXISTS public.typing_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_typing BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

-- Enable RLS on typing_status
ALTER TABLE public.typing_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for typing_status
CREATE POLICY "Users can view typing status in their chats"
ON public.typing_status
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chats 
    WHERE chats.id = typing_status.chat_id 
    AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can update their own typing status"
ON public.typing_status
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update typing status"
ON public.typing_status
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own typing status"
ON public.typing_status
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for typing_status
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_status;