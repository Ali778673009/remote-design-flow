-- Create storage policies for the designs bucket
CREATE POLICY "Allow authenticated users to upload their own design files" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'designs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow users to view design files" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'designs');

CREATE POLICY "Allow users to update their own design files" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'designs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow users to delete their own design files" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'designs' AND auth.uid()::text = (storage.foldername(name))[1]);