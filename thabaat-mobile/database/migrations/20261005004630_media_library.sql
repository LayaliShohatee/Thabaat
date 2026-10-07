-- Private-object media catalog. Apply to approved staging only; no content is seeded.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS public.media_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 150),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=5000),
 category text NOT NULL CHECK(length(trim(category)) BETWEEN 2 AND 80),
 object_path text NOT NULL UNIQUE CHECK(object_path ~ '^[A-Za-z0-9][A-Za-z0-9/_-]*\.(mp4|mov)$' AND object_path NOT LIKE '%..%'),
 members_only boolean NOT NULL DEFAULT false, published boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.media_progress (
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 media_id uuid NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
 seconds double precision NOT NULL CHECK(seconds >= 0 AND seconds < 86400),
 PRIMARY KEY(user_id,media_id)
);
CREATE OR REPLACE FUNCTION private.media_access(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.media_items i WHERE i.id=p_id AND
 ((public.current_staff_role()='admin' OR (public.current_staff_role()='organizer' AND i.created_by=auth.uid())) OR
 (i.published AND (NOT i.members_only OR EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=auth.uid() AND m.status='active' AND m.starts_at<=now() AND m.expires_at>now() AND m.verified_at<=now())))))
$$;
CREATE OR REPLACE FUNCTION private.media_manage(p_owner uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (public.current_staff_role()='admin' OR (public.current_staff_role()='organizer' AND p_owner=auth.uid()))
$$;
REVOKE ALL ON FUNCTION private.media_access(uuid),private.media_manage(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.media_access(uuid),private.media_manage(uuid) TO authenticated;
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_items,public.media_progress FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.media_items TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.media_progress TO authenticated;
GRANT ALL ON public.media_items,public.media_progress TO service_role;
DROP POLICY IF EXISTS media_catalog ON public.media_items;
CREATE POLICY media_catalog ON public.media_items FOR SELECT TO authenticated USING(published OR private.media_manage(created_by));
DROP POLICY IF EXISTS media_create ON public.media_items;
CREATE POLICY media_create ON public.media_items FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND private.media_manage(created_by));
DROP POLICY IF EXISTS media_edit ON public.media_items;
CREATE POLICY media_edit ON public.media_items FOR UPDATE TO authenticated USING(private.media_manage(created_by)) WITH CHECK(private.media_manage(created_by));
DROP POLICY IF EXISTS media_delete ON public.media_items;
CREATE POLICY media_delete ON public.media_items FOR DELETE TO authenticated USING(private.media_manage(created_by));
DROP POLICY IF EXISTS media_progress_read ON public.media_progress;
CREATE POLICY media_progress_read ON public.media_progress FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS media_progress_create ON public.media_progress;
CREATE POLICY media_progress_create ON public.media_progress FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND private.media_access(media_id));
DROP POLICY IF EXISTS media_progress_update ON public.media_progress;
CREATE POLICY media_progress_update ON public.media_progress FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid() AND private.media_access(media_id));
DROP POLICY IF EXISTS media_progress_delete ON public.media_progress;
CREATE POLICY media_progress_delete ON public.media_progress FOR DELETE TO authenticated USING(user_id=auth.uid());
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('thabaat-media','thabaat-media',false,524288000,ARRAY['video/mp4','video/quicktime'])
 ON CONFLICT(id) DO NOTHING;
-- Never silently convert an existing public bucket to private or rely on it for gated content.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='thabaat-media' AND public) THEN RAISE EXCEPTION 'Existing media bucket must be private before rollout'; END IF; END $$;
DROP POLICY IF EXISTS thabaat_media_read ON storage.objects;
-- Clients cannot mint their own longer-lived tokens, even if another permissive policy exists.
DROP POLICY IF EXISTS thabaat_media_guard ON storage.objects;
CREATE POLICY thabaat_media_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'thabaat-media');
CREATE OR REPLACE FUNCTION public.get_media_playback_path(p_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result text;
BEGIN
 IF NOT private.media_access(p_id) THEN RAISE EXCEPTION 'Media access denied'; END IF;
 SELECT object_path INTO result FROM public.media_items WHERE id=p_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_media_playback_path(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_media_playback_path(uuid) TO authenticated;
COMMIT;
