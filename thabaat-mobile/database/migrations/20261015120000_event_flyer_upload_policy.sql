-- Flyer uploads were rejected with "new row violates row-level security policy for table objects".
-- The storage service checks the INSERT policy before the object's metadata (mimetype, size) is
-- recorded, so the metadata clauses in thabaat_event_image_upload could never be satisfied.
-- The bucket row already enforces the same limits (allowed_mime_types = jpeg/png/webp,
-- file_size_limit = 5 MB), so the policy keeps the role and path checks and the bucket keeps the limits.
BEGIN;
DROP POLICY IF EXISTS thabaat_event_image_upload ON storage.objects;
CREATE POLICY thabaat_event_image_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='thabaat-event-images' AND public.current_staff_role() IN ('admin','organizer')
 AND name ~ ('^' || auth.uid()::text || '/[a-f0-9]{32}\.(jpg|png|webp)$')
);
UPDATE storage.buckets SET file_size_limit=5242880, allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'] WHERE id='thabaat-event-images';
COMMIT;
