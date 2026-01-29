import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const NOTIFICATION_PROMPT_KEY = 'mera_notification_prompt_shown';
const NOTIFICATION_SKIPPED_KEY = 'mera_notification_skipped';

export const useNotificationPermission = () => {
  const { user } = useAuth();
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

  // Check current permission status
  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  // Register service worker
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

  // Request permission from OS
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    
    if (result === 'granted') {
      await registerServiceWorker();
      
      // Save device token (in a real app, you'd get FCM token here)
      if (user) {
        // For web, we just mark notifications as enabled
        localStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true');
      }
      
      return true;
    }
    
    return false;
  }, [user, registerServiceWorker]);

  // Check if we should show the permission prompt
  const shouldPromptForPermission = useCallback(() => {
    if (permission !== 'default') return false;
    if (localStorage.getItem(NOTIFICATION_SKIPPED_KEY)) return false;
    if (localStorage.getItem(NOTIFICATION_PROMPT_KEY)) return false;
    return true;
  }, [permission]);

  // Trigger permission prompt (called on specific user actions)
  const triggerPermissionPrompt = useCallback(() => {
    if (shouldPromptForPermission()) {
      setShowPermissionModal(true);
    }
  }, [shouldPromptForPermission]);

  // Skip permission prompt
  const skipPermissionPrompt = useCallback(() => {
    localStorage.setItem(NOTIFICATION_SKIPPED_KEY, 'true');
    setShowPermissionModal(false);
  }, []);

  // Show local notification
  const showLocalNotification = useCallback(async (
    title: string,
    options: NotificationOptions & { data?: Record<string, unknown> }
  ) => {
    if (permission !== 'granted') return;

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }, [permission]);

  return {
    permission,
    showPermissionModal,
    setShowPermissionModal,
    requestPermission,
    triggerPermissionPrompt,
    skipPermissionPrompt,
    showLocalNotification,
    isSupported: permission !== 'unsupported',
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
  };
};
