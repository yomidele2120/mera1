import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Cache for signed URLs to avoid redundant requests
const urlCache = new Map<string, { url: string; expiry: number }>();

export const useSignedUrl = (
  filePath: string | null,
  chatId: string | undefined,
  isPrivate: boolean = false
) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath || !isPrivate) {
      // If not private, just use the original URL
      setSignedUrl(filePath);
      return;
    }

    if (!chatId) {
      setError('Chat ID required for private media');
      return;
    }

    const cacheKey = `${chatId}:${filePath}`;
    const cached = urlCache.get(cacheKey);
    
    // Check if cached URL is still valid (with 5 minute buffer)
    if (cached && cached.expiry > Date.now() + 5 * 60 * 1000) {
      setSignedUrl(cached.url);
      return;
    }

    const fetchSignedUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token) {
          throw new Error('Not authenticated');
        }

        const response = await supabase.functions.invoke('get-signed-url', {
          body: { filePath, chatId }
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to get signed URL');
        }

        const { signedUrl: url } = response.data;
        
        // Cache the URL (expires in 1 hour, we got it from the edge function)
        urlCache.set(cacheKey, {
          url,
          expiry: Date.now() + 55 * 60 * 1000 // 55 minutes to be safe
        });

        setSignedUrl(url);
      } catch (err) {
        console.error('Error fetching signed URL:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [filePath, chatId, isPrivate]);

  return { signedUrl, loading, error };
};

// Helper to extract file path from a media URL
export const extractPrivateMediaPath = (url: string | null): string | null => {
  if (!url) return null;
  
  // Check if it's a private-media URL
  if (!url.includes('/private-media/')) return null;
  
  // Extract the path after /private-media/
  const match = url.match(/\/private-media\/(.+)/);
  return match ? match[1] : null;
};

// Helper to check if URL is for private media
export const isPrivateMediaUrl = (url: string | null): boolean => {
  if (!url) return false;
  return url.includes('/private-media/');
};
