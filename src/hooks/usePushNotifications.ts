import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const usePushNotifications = () => {
  const { user } = useAuth();

  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  const showLocalNotification = useCallback((title: string, options: NotificationOptions & { data?: Record<string, unknown> }) => {
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options
        });
      });
    }
  }, []);

  // Subscribe to new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-messages')
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
  }, [user, showLocalNotification]);

  // Subscribe to new likes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-likes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'likes'
        },
        async (payload) => {
          const like = payload.new as { user_id: string; post_id: string };
          
          // Don't notify for own likes
          if (like.user_id === user.id) return;

          // Check if the liked post belongs to us
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
  }, [user, showLocalNotification]);

  // Initialize on mount
  useEffect(() => {
    registerServiceWorker();
    requestPermission();
  }, [registerServiceWorker, requestPermission]);

  return {
    showLocalNotification,
    requestPermission
  };
};
