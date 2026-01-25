-- Add media_urls column to posts table to support multiple media files
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS media_urls text[] DEFAULT '{}';

-- Comment explaining the column
COMMENT ON COLUMN public.posts.media_urls IS 'Array of media URLs for multi-media posts (carousel support)';