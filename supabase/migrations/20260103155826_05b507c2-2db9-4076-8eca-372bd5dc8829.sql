-- Create private bucket for chat media (messages, voice recordings)
INSERT INTO storage.buckets (id, name, public)
VALUES ('private-media', 'private-media', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Users can upload to their own folder
CREATE POLICY "Users can upload private media to own folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'private-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS policy: Users can view private media in chats they're part of
-- The folder structure is: user_id/chat_id/filename
CREATE POLICY "Users can view private media in their chats"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'private-media'
  AND EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = (storage.foldername(name))[2]::uuid
    AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
  )
);

-- RLS policy: Users can delete their own private media
CREATE POLICY "Users can delete own private media"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'private-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);