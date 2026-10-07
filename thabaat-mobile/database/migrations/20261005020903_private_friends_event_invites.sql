-- Local only. Known-ID requests never search accounts or send external messages.
BEGIN;
CREATE TABLE IF NOT EXISTS public.friend_relationships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),low_user uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,high_user uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 requested_by uuid NOT NULL REFERENCES public.profiles(id),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','removed')),
 requested_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(low_user,high_user),CHECK(low_user<high_user),CHECK(requested_by IN (low_user,high_user))
);
CREATE TABLE IF NOT EXISTS public.social_privacy(user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,share_attendance boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.friend_event_invites(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','opened','dismissed','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(sender_id,recipient_id,event_id),CHECK(sender_id<>recipient_id)
);
CREATE INDEX IF NOT EXISTS friend_relationships_high_idx ON public.friend_relationships(high_user,status);
CREATE INDEX IF NOT EXISTS friend_invites_recipient_idx ON public.friend_event_invites(recipient_id,status,created_at DESC);
ALTER TABLE public.friend_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_privacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_event_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.friend_relationships,public.social_privacy,public.friend_event_invites FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.friend_relationships,public.social_privacy,public.friend_event_invites TO service_role;
CREATE OR REPLACE FUNCTION public.request_known_friend(p_friend_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); low_id uuid; high_id uuid; old_record public.friend_relationships;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_friend_id IS NULL OR p_friend_id=me THEN RAISE EXCEPTION 'Enter another account ID'; END IF;
 low_id:=least(me,p_friend_id);high_id:=greatest(me,p_friend_id);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(low_id::text||high_id::text,29742905));
 -- Uniform result, no outgoing request enumeration: unknown, pending, declined and accepted accounts all return void.
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_friend_id) THEN RETURN; END IF;
 SELECT * INTO old_record FROM public.friend_relationships WHERE low_user=low_id AND high_user=high_id FOR UPDATE;
 IF FOUND THEN
 IF old_record.status IN ('removed','declined') THEN UPDATE public.friend_relationships SET requested_by=me,status='pending',requested_at=now(),updated_at=now() WHERE id=old_record.id; END IF;
 ELSE INSERT INTO public.friend_relationships(low_user,high_user,requested_by) VALUES(low_id,high_id,me); END IF;
END $$;
CREATE OR REPLACE FUNCTION public.respond_friend_request(p_request_id uuid,p_accept boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); r public.friend_relationships;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO r FROM public.friend_relationships WHERE id=p_request_id;
 IF NOT FOUND OR me NOT IN(r.low_user,r.high_user) OR r.requested_by=me OR p_accept IS NULL THEN RAISE EXCEPTION 'Friend request unavailable'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.low_user::text||r.high_user::text,29742905));
 SELECT * INTO r FROM public.friend_relationships WHERE id=p_request_id FOR UPDATE;
 IF r.requested_by=me OR r.status NOT IN ('pending',CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END) THEN RAISE EXCEPTION 'Friend request unavailable'; END IF;
 UPDATE public.friend_relationships SET status=CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,updated_at=now() WHERE id=r.id;
END $$;
CREATE OR REPLACE FUNCTION public.remove_known_friend(p_friend_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); low_id uuid; high_id uuid;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_friend_id IS NULL OR p_friend_id=me THEN RAISE EXCEPTION 'Enter another account ID'; END IF;
 low_id:=least(me,p_friend_id);high_id:=greatest(me,p_friend_id);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(low_id::text||high_id::text,29742905));
 UPDATE public.friend_relationships SET status='removed',updated_at=now() WHERE low_user=low_id AND high_user=high_id;
 UPDATE public.friend_event_invites SET status='revoked',updated_at=now() WHERE status IN ('pending','opened') AND ((sender_id=me AND recipient_id=p_friend_id) OR (sender_id=p_friend_id AND recipient_id=me));
END $$;
CREATE OR REPLACE FUNCTION public.set_attendance_privacy(p_share boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_share IS NULL THEN RAISE EXCEPTION 'Choose attendance sharing on or off'; END IF;
 INSERT INTO public.social_privacy(user_id,share_attendance) VALUES(auth.uid(),p_share) ON CONFLICT(user_id) DO UPDATE SET share_attendance=excluded.share_attendance,updated_at=now();
END $$;
CREATE OR REPLACE FUNCTION public.my_friend_network() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); friends jsonb; requests jsonb; invites jsonb;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'full_name',p.full_name) ORDER BY p.full_name,p.id),'[]'::jsonb) INTO friends FROM public.friend_relationships r JOIN public.profiles p ON p.id=CASE WHEN r.low_user=me THEN r.high_user ELSE r.low_user END WHERE me IN(r.low_user,r.high_user) AND r.status='accepted';
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'requester_name',p.full_name,'requested_at',r.requested_at) ORDER BY r.requested_at,r.id),'[]'::jsonb) INTO requests FROM public.friend_relationships r JOIN public.profiles p ON p.id=r.requested_by WHERE me IN(r.low_user,r.high_user) AND r.status='pending' AND r.requested_by<>me;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'sender_name',p.full_name,'event_title',CASE WHEN NOT e.members_only OR public.has_active_membership(me) THEN e.title ELSE 'Member event' END,'event_id',i.event_id,'status',i.status,'created_at',i.created_at) ORDER BY i.created_at DESC,i.id),'[]'::jsonb) INTO invites FROM public.friend_event_invites i JOIN public.profiles p ON p.id=i.sender_id JOIN public.events e ON e.id=i.event_id JOIN public.friend_relationships r ON r.low_user=least(i.sender_id,me) AND r.high_user=greatest(i.sender_id,me) AND r.status='accepted' WHERE i.recipient_id=me AND i.status IN ('pending','opened') AND NOT e.archived AND e.event_date>now();
 RETURN jsonb_build_object('account_id',me,'share_attendance',coalesce((SELECT share_attendance FROM public.social_privacy WHERE user_id=me),false),'friends',friends,'requests',requests,'invitations',invites);
END $$;
CREATE OR REPLACE FUNCTION public.invite_friend_to_event(p_friend_id uuid,p_event_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); e public.events;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_friend_id IS NULL OR p_friend_id=me THEN RAISE EXCEPTION 'Choose an accepted friend'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(me,p_friend_id)::text||greatest(me,p_friend_id)::text,29742905));
 IF NOT EXISTS(SELECT 1 FROM public.friend_relationships WHERE low_user=least(me,p_friend_id) AND high_user=greatest(me,p_friend_id) AND status='accepted') THEN RAISE EXCEPTION 'Choose an accepted friend'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event_id;
 IF NOT FOUND OR e.archived OR e.event_date<=now() THEN RAISE EXCEPTION 'Event unavailable'; END IF;
 IF e.members_only AND NOT public.has_active_membership(me) THEN RAISE EXCEPTION 'An active verified membership is required for this event'; END IF;
 INSERT INTO public.friend_event_invites(sender_id,recipient_id,event_id) VALUES(me,p_friend_id,e.id) ON CONFLICT(sender_id,recipient_id,event_id) DO UPDATE SET status=CASE WHEN public.friend_event_invites.status='revoked' THEN 'pending' ELSE public.friend_event_invites.status END,updated_at=now();
END $$;
CREATE OR REPLACE FUNCTION public.open_friend_event_invite(p_invite_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); i public.friend_event_invites; e public.events;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO i FROM public.friend_event_invites WHERE id=p_invite_id AND recipient_id=me;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(me,i.sender_id)::text||greatest(me,i.sender_id)::text,29742905));
 SELECT * INTO i FROM public.friend_event_invites WHERE id=p_invite_id AND recipient_id=me FOR UPDATE;
 IF i.status NOT IN('pending','opened') OR NOT EXISTS(SELECT 1 FROM public.friend_relationships WHERE low_user=least(me,i.sender_id) AND high_user=greatest(me,i.sender_id) AND status='accepted') THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 SELECT * INTO e FROM public.events WHERE id=i.event_id;
 IF NOT FOUND OR e.archived OR e.event_date<=now() THEN RAISE EXCEPTION 'Event unavailable'; END IF;
 IF e.members_only AND NOT public.has_active_membership(me) THEN RAISE EXCEPTION 'An active verified membership is required for this event'; END IF;
 UPDATE public.friend_event_invites SET status='opened',updated_at=now() WHERE id=i.id;
 RETURN e.id;
END $$;
CREATE OR REPLACE FUNCTION public.dismiss_friend_event_invite(p_invite_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.friend_event_invites WHERE id=p_invite_id AND recipient_id=auth.uid() AND status<>'revoked') THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 UPDATE public.friend_event_invites SET status='dismissed',updated_at=now() WHERE id=p_invite_id AND recipient_id=auth.uid();
END $$;
CREATE OR REPLACE FUNCTION public.friends_attending_event(p_event_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); e public.events;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO e FROM public.events WHERE id=p_event_id;
 IF NOT FOUND OR e.archived OR e.event_date<=now() THEN RAISE EXCEPTION 'Event unavailable'; END IF;
 IF e.members_only AND NOT public.has_active_membership(me) THEN RAISE EXCEPTION 'An active verified membership is required for this event'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',p.id,'full_name',p.full_name) ORDER BY p.full_name,p.id) FROM public.friend_relationships r JOIN public.profiles p ON p.id=CASE WHEN r.low_user=me THEN r.high_user ELSE r.low_user END JOIN public.social_privacy settings ON settings.user_id=p.id AND settings.share_attendance JOIN public.registrations booking ON booking.user_id=p.id AND booking.event_id=e.id AND booking.status='confirmed' WHERE me IN(r.low_user,r.high_user) AND r.status='accepted' AND (NOT e.members_only OR public.has_active_membership(p.id))),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.request_known_friend(uuid),public.respond_friend_request(uuid,boolean),public.remove_known_friend(uuid),public.set_attendance_privacy(boolean),public.my_friend_network(),public.invite_friend_to_event(uuid,uuid),public.open_friend_event_invite(uuid),public.dismiss_friend_event_invite(uuid),public.friends_attending_event(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_known_friend(uuid),public.respond_friend_request(uuid,boolean),public.remove_known_friend(uuid),public.set_attendance_privacy(boolean),public.my_friend_network(),public.invite_friend_to_event(uuid,uuid),public.open_friend_event_invite(uuid),public.dismiss_friend_event_invite(uuid),public.friends_attending_event(uuid) TO authenticated;
COMMIT;
