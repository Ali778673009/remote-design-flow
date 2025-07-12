-- Fix Security Warning: Restrict designs table access
-- Currently anonymous users can view all designs, which may be a privacy concern

-- Drop the overly permissive policy that allows anonymous users to view all designs
DROP POLICY IF EXISTS "Allow users to view all designs" ON public.designs;

-- Create more secure policies for designs table
CREATE POLICY "Users can view their own designs" 
ON public.designs 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Allow admins to view all designs
CREATE POLICY "Admins can view all designs" 
ON public.designs 
FOR SELECT 
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin');

-- Allow users to update their own designs
CREATE POLICY "Users can update their own designs" 
ON public.designs 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own designs
CREATE POLICY "Users can delete their own designs" 
ON public.designs 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Allow admins to manage all designs
CREATE POLICY "Admins can manage all designs" 
ON public.designs 
FOR ALL 
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin');