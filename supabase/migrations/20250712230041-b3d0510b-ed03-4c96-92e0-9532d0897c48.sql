-- Make designs table publicly accessible
-- User requested to remove protection and allow public access

-- Drop all existing policies on designs table
DROP POLICY IF EXISTS "Users can view their own designs" ON public.designs;
DROP POLICY IF EXISTS "Admins can view all designs" ON public.designs;
DROP POLICY IF EXISTS "Users can update their own designs" ON public.designs;
DROP POLICY IF EXISTS "Users can delete their own designs" ON public.designs;
DROP POLICY IF EXISTS "Admins can manage all designs" ON public.designs;
DROP POLICY IF EXISTS "Allow authenticated users to insert their own designs" ON public.designs;

-- Create public access policies
CREATE POLICY "Allow everyone to view all designs" 
ON public.designs 
FOR SELECT 
USING (true);

-- Allow authenticated users to insert their own designs
CREATE POLICY "Allow authenticated users to insert their own designs" 
ON public.designs 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

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