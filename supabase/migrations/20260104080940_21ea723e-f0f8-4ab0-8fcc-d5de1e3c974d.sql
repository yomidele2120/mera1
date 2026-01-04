-- Update the generate_user_number function to create random 10-digit numbers starting with 90
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
    -- Generate random 10-digit number starting with 90 (9000000000 to 9099999999)
    LOOP
      v_user_number := floor(random() * (9099999999 - 9000000000 + 1) + 9000000000)::bigint;
      
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

-- Update all existing users with new 10-digit numbers starting with 90
DO $$
DECLARE
  profile_record RECORD;
  v_new_number bigint;
  v_attempts integer;
BEGIN
  FOR profile_record IN SELECT id FROM public.profiles LOOP
    v_attempts := 0;
    LOOP
      v_new_number := floor(random() * (9099999999 - 9000000000 + 1) + 9000000000)::bigint;
      
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_number = v_new_number AND id != profile_record.id) THEN
        UPDATE public.profiles SET user_number = v_new_number WHERE id = profile_record.id;
        EXIT;
      END IF;
      
      v_attempts := v_attempts + 1;
      IF v_attempts >= 100 THEN
        RAISE EXCEPTION 'Could not generate unique user number for profile %', profile_record.id;
      END IF;
    END LOOP;
  END LOOP;
END $$;