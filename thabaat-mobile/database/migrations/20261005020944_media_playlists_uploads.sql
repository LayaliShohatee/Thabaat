BEGIN;
-- Private personal playlists contain references only; playback still requires the existing caller RPC.
CREATE TABLE public.media_playlists (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.media_playlist_items (
 playlist_id uuid NOT NULL REFERENCES public.media_playlists(id) ON DELETE CASCADE,
 media_id uuid NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK(position BETWEEN 0 AND 9999), PRIMARY KEY(playlist_id,media_id)
);
CREATE INDEX media_playlists_owner ON public.media_playlists(user_id,created_at);
CREATE INDEX media_playlist_items_media ON public.media_playlist_items(media_id);
CREATE FUNCTION private.owns_media_playlist(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.media_playlists WHERE id=p_id AND user_id=auth.uid())
$$;
REVOKE ALL ON FUNCTION private.owns_media_playlist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.owns_media_playlist(uuid) TO authenticated;
ALTER TABLE public.media_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_playlist_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_playlists,public.media_playlist_items FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.media_playlists,public.media_playlist_items TO authenticated;
GRANT ALL ON public.media_playlists,public.media_playlist_items TO service_role;
CREATE POLICY own_playlists ON public.media_playlists TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY own_playlist_items ON public.media_playlist_items TO authenticated USING(private.owns_media_playlist(playlist_id)) WITH CHECK(private.owns_media_playlist(playlist_id) AND EXISTS(SELECT 1 FROM public.media_items WHERE id=media_id));
CREATE FUNCTION public.move_media_playlist_item(p_playlist_id uuid,p_media_id uuid,p_direction integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ids uuid[]; source integer; target integer; swap uuid;
BEGIN
 IF pg_catalog.to_regprocedure('public.assert_active_account()') IS NOT NULL THEN PERFORM public.assert_active_account(); END IF;
 IF p_direction NOT IN (-1,1) THEN RAISE EXCEPTION 'Invalid playlist direction'; END IF;
 PERFORM 1 FROM public.media_playlists WHERE id=p_playlist_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Playlist access denied'; END IF;
 SELECT array_agg(media_id ORDER BY position,media_id) INTO ids FROM public.media_playlist_items WHERE playlist_id=p_playlist_id;
 source:=array_position(ids,p_media_id);target:=source+p_direction;
 IF source IS NULL OR target<1 OR target>array_length(ids,1) THEN RETURN; END IF;
 swap:=ids[target];ids[target]:=ids[source];ids[source]:=swap;
 UPDATE public.media_playlist_items i SET position=ordered.rank-1 FROM unnest(ids) WITH ORDINALITY AS ordered(id,rank) WHERE i.playlist_id=p_playlist_id AND i.media_id=ordered.id;
END $$;
REVOKE ALL ON FUNCTION public.move_media_playlist_item(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.move_media_playlist_item(uuid,uuid,integer) TO authenticated;
-- A fresh non-overwriting upload is limited to the staff user's namespace. Read remains server-signed only.
CREATE POLICY thabaat_media_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='thabaat-media' AND public.current_staff_role() IN ('admin','organizer')
 AND name ~ ('^' || auth.uid()::text || '/[a-f0-9]{32}\.(mp4|mov)$')
 AND (metadata->>'mimetype') IN ('video/mp4','video/quicktime')
 AND (metadata->>'size')::bigint BETWEEN 12 AND 104857600
);
CREATE POLICY thabaat_media_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
 bucket_id<>'thabaat-media' OR (public.current_staff_role() IN ('admin','organizer')
 AND name ~ ('^' || auth.uid()::text || '/[a-f0-9]{32}\.(mp4|mov)$')
 AND (metadata->>'mimetype') IN ('video/mp4','video/quicktime')
 AND (metadata->>'size')::bigint BETWEEN 12 AND 104857600)
);
CREATE FUNCTION private.enforce_media_upload_namespace() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND public.current_staff_role() IS DISTINCT FROM 'admin' AND
 (TG_OP='INSERT' OR NEW.object_path IS DISTINCT FROM OLD.object_path) AND
 NEW.object_path NOT LIKE auth.uid()::text || '/%' THEN RAISE EXCEPTION 'Use a video uploaded to your own media namespace'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER media_upload_namespace BEFORE INSERT OR UPDATE OF object_path ON public.media_items FOR EACH ROW EXECUTE FUNCTION private.enforce_media_upload_namespace();
COMMIT;
