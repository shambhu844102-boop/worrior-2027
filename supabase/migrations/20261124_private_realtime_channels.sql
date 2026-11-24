-- Keep existing realtime listeners working with public channel access disabled.
-- These only authorize already-authenticated profiles to their expected topics.
DROP POLICY IF EXISTS "WORRIOR members can receive group message updates" ON realtime.messages;
DROP POLICY IF EXISTS "WORRIOR members can receive own notification updates" ON realtime.messages;

CREATE POLICY "WORRIOR members can receive group message updates"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (SELECT realtime.topic()) = 'group-messages'
  AND EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
  )
);

CREATE POLICY "WORRIOR members can receive own notification updates"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (SELECT realtime.topic()) = 'notifications-' || (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
  )
);