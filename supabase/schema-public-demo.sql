-- ============================================================
-- ReTrack — Public Demo Access
-- Run in Supabase SQL Editor to allow unauthenticated access
-- to demo data (rows where org_id IS NULL).
-- ============================================================

DROP POLICY IF EXISTS "anon_demo_categories" ON public.categories;
CREATE POLICY "anon_demo_categories" ON public.categories
  FOR ALL TO anon
  USING (org_id IS NULL)
  WITH CHECK (org_id IS NULL);

DROP POLICY IF EXISTS "anon_demo_items" ON public.items;
CREATE POLICY "anon_demo_items" ON public.items
  FOR ALL TO anon
  USING (org_id IS NULL)
  WITH CHECK (org_id IS NULL);

DROP POLICY IF EXISTS "anon_demo_groups" ON public.groups;
CREATE POLICY "anon_demo_groups" ON public.groups
  FOR ALL TO anon
  USING (org_id IS NULL)
  WITH CHECK (org_id IS NULL);

DROP POLICY IF EXISTS "anon_demo_logs" ON public.logs;
CREATE POLICY "anon_demo_logs" ON public.logs
  FOR ALL TO anon
  USING (org_id IS NULL)
  WITH CHECK (org_id IS NULL);
