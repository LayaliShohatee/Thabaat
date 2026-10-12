-- PROPOSAL ONLY: not a rollout migration. Anonymous execution below is only for
-- explicitly reviewed public publications; existing event/table RLS is unchanged.
-- Requires stakeholder approval of visibility, public fields and anonymous access before staging.
BEGIN;
CREATE SCHEMA IF NOT EXISTS thabaat_public_preview;
REVOKE ALL ON SCHEMA thabaat_public_preview FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS thabaat_public_preview.publications (
 event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
 public_title text NOT NULL CHECK(length(trim(public_title)) BETWEEN 3 AND 150),
 public_summary text NOT NULL CHECK(length(public_summary)<=1000),
 venue_label text NOT NULL CHECK(length(trim(venue_label)) BETWEEN 2 AND 150),
 visible boolean NOT NULL DEFAULT false,
 approved_by uuid NOT NULL REFERENCES public.profiles(id), approved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE thabaat_public_preview.publications ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS thabaat_public_preview.audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL,actor_id uuid NOT NULL,visible boolean NOT NULL,changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE thabaat_public_preview.audit ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.reviewed_public_event(p_id uuid)
RETURNS TABLE(event_id uuid,title text,summary text,event_date timestamptz,venue text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.event_id,p.public_title,p.public_summary,e.event_date,p.venue_label
 FROM thabaat_public_preview.publications p JOIN public.events e ON e.id=p.event_id
 WHERE p.event_id=p_id AND p.visible AND NOT e.archived AND NOT e.members_only
$$;
REVOKE ALL ON FUNCTION public.reviewed_public_event(uuid) FROM PUBLIC;
-- This grant is a proposed change; never apply without the specific access-policy approval.
GRANT EXECUTE ON FUNCTION public.reviewed_public_event(uuid) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.set_reviewed_public_event(p_id uuid,p_title text,p_summary text,p_venue text,p_visible boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=p_id AND NOT archived AND NOT members_only) THEN RAISE EXCEPTION 'Only a non-archived non-member event may be reviewed for public publication'; END IF;
 INSERT INTO thabaat_public_preview.publications(event_id,public_title,public_summary,venue_label,visible,approved_by)
 VALUES(p_id,trim(p_title),p_summary,trim(p_venue),p_visible,auth.uid())
 ON CONFLICT(event_id) DO UPDATE SET public_title=excluded.public_title,public_summary=excluded.public_summary,venue_label=excluded.venue_label,visible=excluded.visible,approved_by=excluded.approved_by,approved_at=now();
 INSERT INTO thabaat_public_preview.audit(event_id,actor_id,visible) VALUES(p_id,auth.uid(),p_visible);
END $$;
REVOKE ALL ON FUNCTION public.set_reviewed_public_event(uuid,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_reviewed_public_event(uuid,text,text,text,boolean) TO authenticated;
COMMIT;
