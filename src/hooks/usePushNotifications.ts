import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationPermission } from './useNotificationPermission';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const { 
    permission, 
    showLocalNotification, 
    isGranted,
    triggerPermissionPrompt,
    showPermissionModal,
    setShowPermissionModal,
    requestPermission,
    skipPermissionPrompt
  } = useNotificationPermission();
  
  const hasTriggeredRef = useRef(false);

  // Trigger permission prompt on first message send
  const onUserSendsFirstMessage = useCallback(() => {
    if (!hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      triggerPermissionPrompt();
    }
  }, [triggerPermissionPrompt]);

  // Subscribe to new messages
  useEffect(() => {
    if (!user || !isGranted) return;

    const channel = supabase
      .channel('push-notifications-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          const message = payload.new as { sender_id: string; chat_id: string; text?: string; message_type: string };
          
          // Don't notify for own messages
          if (message.sender_id === user.id) return;
          
          // Check if document is hidden
          if (document.hidden) {
            // Fetch sender info
            const { data: sender } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', message.sender_id)
              .single();

            if (sender) {
              showLocalNotification('New Message', {
                body: `${sender.username}: ${message.text || 'Sent you media'}`,
                icon: sender.avatar_url || '/favicon.ico',
                tag: `message-${message.chat_id}`,
                data: { url: `/messages/${message.chat_id}` }
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isGranted, showLocalNotification]);

  // Subscribe to message stacks (new messaging system)
  useEffect(() => {
    if (!user || !isGranted) return;

    const channel = supabase
      .channel('push-notifications-stacks')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_stacks'
        },
        async (payload) => {
          const stack = payload.new as { sender_id: string; chat_id: string };
          
          if (stack.sender_id === user.id) return;
          
          if (document.hidden) {
            const { data: sender } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', stack.sender_id)
              .single();

            if (sender) {
              showLocalNotification('New Message', {
                body: `${sender.username} sent you a message`,
                icon: sender.avatar_url || '/favicon.ico',
                tag: `stack-${stack.chat_id}`,
                data: { url: `/messages/${stack.chat_id}` }
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isGranted, showLocalNotification]);

  // Subscribe to new likes
  useEffect(() => {
    if (!user || !isGranted) return;

    const channel = supabase
      .channel('push-notifications-likes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'likes'
        },
        async (payload) => {
          const like = payload.new as { user_id: string; post_id: string };
          
          if (like.user_id === user.id) return;

          const { data: post } = await supabase
            .from('posts')
            .select('user_id')
            .eq('id', like.post_id)
            .single();

          if (post?.user_id !== user.id) return;

          if (document.hidden) {
            const { data: liker } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', like.user_id)
              .single();

            if (liker) {
              showLocalNotification('New Like', {
                body: `${liker.username} liked your post`,
                icon: liker.avatar_url || '/favicon.ico',
                tag: `like-${like.post_id}`,
                data: { url: `/post/${like.post_id}` }
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isGranted, showLocalNotification]);

  // Subscribe to friend requests
  useEffect(() => {
    if (!user || !isGranted) return;

    const channel = supabase
      .channel('push-notifications-friend-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_requests'
        },
        async (payload) => {
          const request = payload.new as { sender_id: string; receiver_id: string };
          
          if (request.receiver_id !== user.id) return;

          if (document.hidden) {
            const { data: sender } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', request.sender_id)
              .single();

            if (sender) {
              showLocalNotification('Friend Request', {
                body: `${sender.username} sent you a friend request`,
                icon: sender.avatar_url || '/favicon.ico',
                tag: 'friend-request',
                data: { url: '/friends' }
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isGranted, showLocalNotification]);

  // Subscribe to missed calls
  useEffect(() => {
    if (!user || !isGranted) return;

    const channel = supabase
      .channel('push-notifications-calls')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls'
        },
        async (payload) => {
          const call = payload.new as { caller_id: string; callee_id: string; status: string };
          
          if (call.callee_id !== user.id || call.status !== 'missed') return;

          if (document.hidden) {
            const { data: caller } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', call.caller_id)
              .single();

            if (caller) {
              showLocalNotification('Missed Call', {
                body: `You missed a call from ${caller.username}`,
                icon: caller.avatar_url || '/favicon.ico',
                tag: 'missed-call',
                data: { url: '/calls' }
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isGranted, showLocalNotification]);

  // Subscribe to new posts from followed users
  useEffect(() => {
    if (!user || !isGranted) return;

    const channel = supabase
      .channel('push-notifications-posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts'
        },
        async (payload) => {
          const post = payload.new as { user_id: string; id: string; caption?: string };
          
          if (post.user_id === user.id) return;

          const { data: following } = await supabase
            .from('followers')
            .select('id')
            .eq('follower_id', user.id)
            .eq('following_id', post.user_id)
            .single();

          if (!following) return;

          if (document.hidden) {
            const { data: poster } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', post.user_id)
              .single();

            if (poster) {
              showLocalNotification('New Post', {
                body: `${poster.username} shared a new post`,
                icon: poster.avatar_url || '/favicon.ico',
                tag: `post-${post.id}`,
                data: { url: `/post/${post.id}` }
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isGranted, showLocalNotification]);

  return {
    showLocalNotification,
    requestPermission,
    permission,
    isGranted,
    onUserSendsFirstMessage,
    showPermissionModal,
    setShowPermissionModal,
    skipPermissionPrompt
  };
};
