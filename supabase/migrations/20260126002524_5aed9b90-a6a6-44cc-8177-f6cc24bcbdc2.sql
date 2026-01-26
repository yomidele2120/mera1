-- =============================================
-- COMPREHENSIVE SCHEMA UPDATE FOR NEW FEATURES
-- =============================================

-- 1. PERSONAS TABLE - Multi-identity system
CREATE TABLE public.personas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    persona_type TEXT NOT NULL DEFAULT 'public' CHECK (persona_type IN ('public', 'friends', 'business', 'anonymous')),
    username TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    privacy_level TEXT NOT NULL DEFAULT 'public' CHECK (privacy_level IN ('public', 'private', 'friends_only')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(username)
);

CREATE INDEX idx_personas_user_id ON public.personas(user_id);
CREATE INDEX idx_personas_username ON public.personas(username);

ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all personas" ON public.personas
    FOR SELECT USING (true);

CREATE POLICY "Users can create their own personas" ON public.personas
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own personas" ON public.personas
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own personas" ON public.personas
    FOR DELETE USING (auth.uid() = user_id);

-- 2. DM TOPICS TABLE - Topic-based threads inside DMs
CREATE TABLE public.dm_topics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'General',
    created_by UUID NOT NULL,
    is_muted BOOLEAN NOT NULL DEFAULT false,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_dm_topics_chat_id ON public.dm_topics(chat_id);

ALTER TABLE public.dm_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view topics in their chats" ON public.dm_topics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chats 
            WHERE chats.id = dm_topics.chat_id 
            AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
        )
    );

CREATE POLICY "Users can create topics in their chats" ON public.dm_topics
    FOR INSERT WITH CHECK (
        auth.uid() = created_by AND
        EXISTS (
            SELECT 1 FROM public.chats 
            WHERE chats.id = chat_id 
            AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
        )
    );

CREATE POLICY "Users can update topics in their chats" ON public.dm_topics
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.chats 
            WHERE chats.id = dm_topics.chat_id 
            AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
        )
    );

CREATE POLICY "Users can delete topics they created" ON public.dm_topics
    FOR DELETE USING (auth.uid() = created_by);

-- 3. MESSAGE STACKS TABLE - Grouped messages
CREATE TABLE public.message_stacks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.dm_topics(id) ON DELETE SET NULL,
    sender_id UUID NOT NULL,
    sender_persona_id UUID REFERENCES public.personas(id) ON DELETE SET NULL,
    post_reference_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_stacks_chat_id ON public.message_stacks(chat_id);
CREATE INDEX idx_message_stacks_topic_id ON public.message_stacks(topic_id);
CREATE INDEX idx_message_stacks_sender_id ON public.message_stacks(sender_id);
CREATE INDEX idx_message_stacks_created_at ON public.message_stacks(created_at DESC);

ALTER TABLE public.message_stacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stacks in their chats" ON public.message_stacks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chats 
            WHERE chats.id = message_stacks.chat_id 
            AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
        )
    );

CREATE POLICY "Users can create stacks in their chats" ON public.message_stacks
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.chats 
            WHERE chats.id = chat_id 
            AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
        )
    );

CREATE POLICY "Users can delete their own stacks" ON public.message_stacks
    FOR DELETE USING (auth.uid() = sender_id);

-- 4. STACK ITEMS TABLE - Individual items within a stack
CREATE TABLE public.stack_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    stack_id UUID NOT NULL REFERENCES public.message_stacks(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL DEFAULT 'text' CHECK (item_type IN ('text', 'image', 'video', 'audio', 'voice', 'gif', 'sticker')),
    content TEXT,
    media_url TEXT,
    duration_seconds INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_stack_items_stack_id ON public.stack_items(stack_id);
CREATE INDEX idx_stack_items_sort_order ON public.stack_items(stack_id, sort_order);

ALTER TABLE public.stack_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view items in stacks they can access" ON public.stack_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.message_stacks ms
            JOIN public.chats c ON c.id = ms.chat_id
            WHERE ms.id = stack_items.stack_id 
            AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        )
    );

CREATE POLICY "Users can create items in their stacks" ON public.stack_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.message_stacks ms
            WHERE ms.id = stack_id AND ms.sender_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete items from their stacks" ON public.stack_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.message_stacks ms
            WHERE ms.id = stack_items.stack_id AND ms.sender_id = auth.uid()
        )
    );

-- 5. STACK REACTIONS TABLE
CREATE TABLE public.stack_reactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    stack_id UUID REFERENCES public.message_stacks(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.stack_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT stack_or_item_required CHECK (stack_id IS NOT NULL OR item_id IS NOT NULL)
);

CREATE INDEX idx_stack_reactions_stack_id ON public.stack_reactions(stack_id);
CREATE INDEX idx_stack_reactions_item_id ON public.stack_reactions(item_id);

ALTER TABLE public.stack_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions in their chats" ON public.stack_reactions
    FOR SELECT USING (true);

CREATE POLICY "Users can add reactions" ON public.stack_reactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their reactions" ON public.stack_reactions
    FOR DELETE USING (auth.uid() = user_id);

-- 6. STACK REPLIES TABLE - Replies to stacks or specific items
CREATE TABLE public.stack_replies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_stack_id UUID REFERENCES public.message_stacks(id) ON DELETE CASCADE,
    parent_item_id UUID REFERENCES public.stack_items(id) ON DELETE CASCADE,
    reply_stack_id UUID NOT NULL REFERENCES public.message_stacks(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT parent_required CHECK (parent_stack_id IS NOT NULL OR parent_item_id IS NOT NULL)
);

CREATE INDEX idx_stack_replies_parent_stack ON public.stack_replies(parent_stack_id);
CREATE INDEX idx_stack_replies_parent_item ON public.stack_replies(parent_item_id);

ALTER TABLE public.stack_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view replies in their chats" ON public.stack_replies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.message_stacks ms
            JOIN public.chats c ON c.id = ms.chat_id
            WHERE ms.id = stack_replies.reply_stack_id 
            AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        )
    );

CREATE POLICY "Users can create replies" ON public.stack_replies
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.message_stacks ms
            WHERE ms.id = reply_stack_id AND ms.sender_id = auth.uid()
        )
    );

-- 7. Add persona_id to existing messages table for backwards compatibility
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_persona_id UUID REFERENCES public.personas(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.dm_topics(id) ON DELETE SET NULL;

-- 8. Add post_reference to chats for feed→chat hybrid
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS post_reference_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS post_slide_index INTEGER DEFAULT NULL;

-- 9. Create function to auto-create default topic for new chats
CREATE OR REPLACE FUNCTION public.create_default_topic()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.dm_topics (chat_id, name, created_by)
    VALUES (NEW.id, 'General', NEW.user1_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_chat_created_create_topic
    AFTER INSERT ON public.chats
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_topic();

-- 10. Create function to auto-create default persona for new users
CREATE OR REPLACE FUNCTION public.create_default_persona()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.personas (user_id, persona_type, username, display_name, is_default)
    VALUES (NEW.id, 'public', NEW.username, NEW.full_name, true);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_profile_created_create_persona
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_persona();

-- 11. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_stacks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stack_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_topics;