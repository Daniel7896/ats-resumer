-- Drop the overly permissive service role policy on the usage_tracking table.
-- The service_role key already bypasses RLS by default in Postgres,
-- so this policy was redundant for the Edge Function. However, because it had
-- no role restriction and no FOR clause, it accidentally let any authenticated user
-- read, write, or delete any other user's usage_tracking row, which would allow
-- them to bypass their quota limits by resetting their own analyses_count.
DROP POLICY IF EXISTS "Service role can modify usage tracking" ON public.usage_tracking;
