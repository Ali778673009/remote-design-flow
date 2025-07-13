-- Fix profiles table RLS policies to allow proper access
-- The current policy might be preventing proper user profile fetching

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile (except role)" ON public.profiles;

-- Create new clear policies
CREATE POLICY "Allow users to view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Allow users to insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to update their own profile data" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Allow admins to view all profiles
CREATE POLICY "Allow admins to view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id OR 
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);