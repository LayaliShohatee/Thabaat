-- #86 Event flyer uploads. Public-read images; uploads limited to admin/organizer in their own folder.
-- Apply only after explicit approval, after 20261005004630_media_library.
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('thabaat-event-images','thabaat-event-images',true,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=true,file_size_limit=5242880,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];
DROP POLICY IF EXISTS thabaat_event_image_upload ON storage.objects;
CREATE POLICY thabaat_event_image_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='thabaat-event-images' AND public.current_staff_role() IN ('admin','organizer')
 AND name ~ ('^' || auth.uid()::text || '/[a-f0-9]{32}\.(jpg|png|webp)$')
 AND (metadata->>'mimetype') IN ('image/jpeg','image/png','image/webp')
 AND (metadata->>'size')::bigint BETWEEN 12 AND 5242880
);
COMMIT;
