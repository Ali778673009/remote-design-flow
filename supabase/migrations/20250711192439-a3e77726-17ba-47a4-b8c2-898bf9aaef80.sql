-- Create tasks table for admin to assign tasks to designers
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  reference_image_url TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  assigned_by UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  completed_design_url TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for tasks
CREATE POLICY "Admins can manage all tasks" 
ON public.tasks 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Designers can view and update their assigned tasks" 
ON public.tasks 
FOR ALL 
TO authenticated
USING (assigned_to = auth.uid());

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  task_id UUID REFERENCES public.tasks(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid());

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add storage policies for reference images
CREATE POLICY "Allow authenticated users to upload reference images" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'designs');

-- Create function to send notification
CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_task_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, task_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_task_id)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;