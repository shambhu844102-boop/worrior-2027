-- Private WORRIOR Live Room: authenticated existing group members only.
-- No existing profiles, accounts, or study records are modified.
DROP POLICY IF EXISTS "WORRIOR members can receive live room events" ON realtime.messages;
DROP POLICY IF EXISTS "WORRIOR members can send live room events" ON realtime.messages;

CREATE POLICY "WORRIOR members can receive live room events"
ON realtime.messages FOR SELECT TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (SELECT realtime.topic()) = 'worrior-2027-live-room'
  AND realtime.messages.extension IN ('broadcast', 'presence')
  AND EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
  )
);

CREATE POLICY "WORRIOR members can send live room events"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND (SELECT realtime.topic()) = 'worrior-2027-live-room'
  AND realtime.messages.extension IN ('broadcast', 'presence')
  AND EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
  )
);