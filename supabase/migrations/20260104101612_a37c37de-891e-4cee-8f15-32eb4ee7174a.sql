-- Allow users to delete their own messages
CREATE POLICY "Users can delete their own messages" 
ON public.messages 
FOR DELETE 
USING (auth.uid() = sender_id);

-- Allow chat participants to delete chats
CREATE POLICY "Users can delete their own chats" 
ON public.chats 
FOR DELETE 
USING (auth.uid() = user1_id OR auth.uid() = user2_id);