-- Security Fix Phase 1: Fix Critical Role Escalation Vulnerability
-- Remove ability for users to update their own role

-- Drop the existing update policy that allows users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new restricted update policy that prevents role changes
CREATE POLICY "Users can update their own profile (except role)" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND 
  -- Prevent role changes by ensuring the role remains the same
  role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- Security Fix Phase 2: Fix Notification Security Gap
-- Add proper INSERT policy for notifications table

CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Security Fix Phase 3: Create security definer function for role checking
-- This prevents RLS recursion issues

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- Create admin-only role management function
CREATE OR REPLACE FUNCTION public.update_user_role(
  target_user_id uuid,
  new_role text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_role text;
BEGIN
  -- Check if current user is admin
  SELECT role INTO current_user_role 
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;
  
  -- Validate the new role
  IF new_role NOT IN ('admin', 'designer') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;
  
  -- Update the role
  UPDATE public.profiles 
  SET role = new_role, updated_at = now()
  WHERE id = target_user_id;
  
  -- Log the role change (audit trail)
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    target_user_id,
    'Role Updated',
    'Your role has been updated to: ' || new_role,
    'info'
  );
  
  RETURN true;
END;
$$;

-- Security Fix Phase 4: Update task policies to use secure role checking
-- Drop existing policies and recreate with better security

DROP POLICY IF EXISTS "Admins can manage all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Designers can view and update their assigned tasks" ON public.tasks;

-- Create new secure policies using the security definer function
CREATE POLICY "Admins can manage all tasks" 
ON public.tasks 
FOR ALL 
TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Designers can view and update their assigned tasks" 
ON public.tasks 
FOR ALL 
TO authenticated
USING (
  assigned_to = auth.uid() OR 
  (public.get_user_role(auth.uid()) = 'admin')
);

-- Add constraint to prevent invalid roles
ALTER TABLE public.profiles 
ADD CONSTRAINT valid_roles 
CHECK (role IN ('admin', 'designer'));

-- Create audit function for sensitive operations
CREATE OR REPLACE FUNCTION public.audit_sensitive_operation(
  operation_type text,
  details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  audit_id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    auth.uid(),
    'Security Audit',
    'Operation: ' || operation_type || ' - Details: ' || details::text,
    'info'
  )
  RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$;