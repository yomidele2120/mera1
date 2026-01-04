-- Add new profile fields for multi-step signup
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS gender text;

-- Create index for date of birth (useful for age verification queries)
CREATE INDEX IF NOT EXISTS idx_profiles_dob ON public.profiles(date_of_birth);