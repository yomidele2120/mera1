-- Create validation trigger function for text length limits
CREATE OR REPLACE FUNCTION public.validate_text_lengths()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate based on table name
  CASE TG_TABLE_NAME
    WHEN 'comments' THEN
      IF NEW.text IS NULL OR length(NEW.text) = 0 THEN
        RAISE EXCEPTION 'Comment text cannot be empty';
      END IF;
      IF length(NEW.text) > 2000 THEN
        RAISE EXCEPTION 'Comment text cannot exceed 2000 characters';
      END IF;
    WHEN 'posts' THEN
      IF NEW.caption IS NOT NULL AND length(NEW.caption) > 500 THEN
        RAISE EXCEPTION 'Caption cannot exceed 500 characters';
      END IF;
      IF NEW.text_content IS NOT NULL AND length(NEW.text_content) > 5000 THEN
        RAISE EXCEPTION 'Text content cannot exceed 5000 characters';
      END IF;
    WHEN 'profiles' THEN
      IF NEW.bio IS NOT NULL AND length(NEW.bio) > 150 THEN
        RAISE EXCEPTION 'Bio cannot exceed 150 characters';
      END IF;
      IF NEW.username IS NULL OR NEW.username !~ '^[a-z0-9_]{3,30}$' THEN
        RAISE EXCEPTION 'Username must be 3-30 lowercase letters, numbers, or underscores';
      END IF;
    WHEN 'reports' THEN
      IF NEW.reason IS NULL OR length(NEW.reason) = 0 THEN
        RAISE EXCEPTION 'Report reason cannot be empty';
      END IF;
      IF length(NEW.reason) > 1000 THEN
        RAISE EXCEPTION 'Report reason cannot exceed 1000 characters';
      END IF;
    WHEN 'messages' THEN
      IF NEW.text IS NOT NULL AND length(NEW.text) > 5000 THEN
        RAISE EXCEPTION 'Message text cannot exceed 5000 characters';
      END IF;
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for each table
CREATE TRIGGER validate_comments_text
  BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_text_lengths();

CREATE TRIGGER validate_posts_text
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_text_lengths();

CREATE TRIGGER validate_profiles_text
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_text_lengths();

CREATE TRIGGER validate_reports_text
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_text_lengths();

CREATE TRIGGER validate_messages_text
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_text_lengths();

-- Create rate limiting table for tracking operations
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  operation text NOT NULL,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  UNIQUE(user_id, operation, window_start)
);

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own rate limit records (for debugging)
CREATE POLICY "Users can view own rate limits"
  ON public.rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_operation text,
  p_max_requests integer DEFAULT 60,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_window_start timestamp with time zone;
  v_current_count integer;
BEGIN
  v_user_id := auth.uid();
  
  -- If no authenticated user, deny
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Calculate window start (truncate to window)
  v_window_start := date_trunc('minute', now());
  
  -- Try to insert or update the rate limit record
  INSERT INTO public.rate_limits (user_id, operation, window_start, request_count)
  VALUES (v_user_id, p_operation, v_window_start, 1)
  ON CONFLICT (user_id, operation, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO v_current_count;
  
  -- Check if over limit
  IF v_current_count > p_max_requests THEN
    RETURN false;
  END IF;
  
  -- Clean up old records (older than 1 hour)
  DELETE FROM public.rate_limits 
  WHERE window_start < now() - interval '1 hour';
  
  RETURN true;
END;
$$;

-- Create rate limiting triggers for critical operations
CREATE OR REPLACE FUNCTION public.enforce_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_max_requests integer;
  v_operation text;
BEGIN
  -- Set limits based on operation type
  v_operation := TG_TABLE_NAME || '_' || TG_OP;
  
  CASE TG_TABLE_NAME
    WHEN 'comments' THEN v_max_requests := 30;  -- 30 comments per minute
    WHEN 'posts' THEN v_max_requests := 10;     -- 10 posts per minute
    WHEN 'messages' THEN v_max_requests := 60;  -- 60 messages per minute
    WHEN 'likes' THEN v_max_requests := 100;    -- 100 likes per minute
    WHEN 'followers' THEN v_max_requests := 50; -- 50 follows per minute
    ELSE v_max_requests := 60;
  END CASE;
  
  IF NOT public.check_rate_limit(v_operation, v_max_requests, 60) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply rate limiting to critical tables
CREATE TRIGGER rate_limit_comments
  BEFORE INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_rate_limit();

CREATE TRIGGER rate_limit_posts
  BEFORE INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_rate_limit();

CREATE TRIGGER rate_limit_messages
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_rate_limit();

CREATE TRIGGER rate_limit_likes
  BEFORE INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_rate_limit();

CREATE TRIGGER rate_limit_followers
  BEFORE INSERT ON public.followers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_rate_limit();