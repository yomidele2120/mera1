-- Update the generate_user_number function to create random 9-12 digit numbers
CREATE OR REPLACE FUNCTION public.generate_user_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_number bigint;
  v_attempts integer := 0;
  v_max_attempts integer := 100;
BEGIN
  IF NEW.user_number IS NULL THEN
    -- Generate random 9-12 digit number, keep trying until unique
    LOOP
      -- Generate random number between 100000000 (9 digits) and 999999999999 (12 digits)
      v_user_number := floor(random() * (999999999999 - 100000000 + 1) + 100000000)::bigint;
      
      -- Check if this number already exists
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_number = v_user_number) THEN
        NEW.user_number := v_user_number;
        EXIT;
      END IF;
      
      v_attempts := v_attempts + 1;
      IF v_attempts >= v_max_attempts THEN
        RAISE EXCEPTION 'Could not generate unique user number after % attempts', v_max_attempts;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;