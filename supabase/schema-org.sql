-- ============================================================
-- ReTrack — Organisation / Multi-Tenancy Migration
-- Run AFTER schema.sql in the Supabase SQL Editor
-- ============================================================

-- ── New tables ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  owner_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.org_members (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id   UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email    TEXT        NOT NULL,
  role     TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, email)
);

-- ── Add org_id to existing data tables ───────────────────────
-- NULL means demo data; a UUID links to an organization.

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.items      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.groups     ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.logs       ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_categories_org ON public.categories(org_id);
CREATE INDEX IF NOT EXISTS idx_items_org      ON public.items(org_id);
CREATE INDEX IF NOT EXISTS idx_groups_org     ON public.groups(org_id);
CREATE INDEX IF NOT EXISTS idx_logs_org       ON public.logs(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_email ON public.org_members(email);
CREATE INDEX IF NOT EXISTS idx_org_members_org   ON public.org_members(org_id);

-- ── SECURITY DEFINER helpers ──────────────────────────────────
-- These run as the DB owner, bypassing RLS, so policies that
-- need to read org_members don't trigger infinite recursion.

CREATE OR REPLACE FUNCTION public.get_my_org_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT org_id FROM public.org_members
  WHERE email = (auth.jwt() ->> 'email')
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_org_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT org_id FROM public.org_members
  WHERE email = (auth.jwt() ->> 'email') AND role = 'admin'
$$;

-- ── Row Level Security for new tables ────────────────────────

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members   ENABLE ROW LEVEL SECURITY;

-- organizations: members can read; owner can insert/update/delete
DROP POLICY IF EXISTS "org_read"   ON public.organizations;
DROP POLICY IF EXISTS "org_insert" ON public.organizations;
DROP POLICY IF EXISTS "org_update" ON public.organizations;
DROP POLICY IF EXISTS "org_delete" ON public.organizations;

CREATE POLICY "org_read" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT public.get_my_org_ids())
  );

CREATE POLICY "org_insert" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "org_update" ON public.organizations
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "org_delete" ON public.organizations
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- org_members: admins can insert/update/delete; any member can read
DROP POLICY IF EXISTS "org_members_read"   ON public.org_members;
DROP POLICY IF EXISTS "org_members_insert" ON public.org_members;
DROP POLICY IF EXISTS "org_members_update" ON public.org_members;
DROP POLICY IF EXISTS "org_members_delete" ON public.org_members;

CREATE POLICY "org_members_read" ON public.org_members
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.get_my_org_ids())
    OR org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  );

CREATE POLICY "org_members_insert" ON public.org_members
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT public.get_my_admin_org_ids())
    OR org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  );

CREATE POLICY "org_members_update" ON public.org_members
  FOR UPDATE TO authenticated
  USING (
    org_id IN (SELECT public.get_my_admin_org_ids())
    OR org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT public.get_my_admin_org_ids())
    OR org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  );

CREATE POLICY "org_members_delete" ON public.org_members
  FOR DELETE TO authenticated
  USING (
    org_id IN (SELECT public.get_my_admin_org_ids())
    OR org_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
  );

-- ── Replace blanket RLS policies on data tables ───────────────
-- Demo rows (org_id IS NULL): visible to all authenticated users.
-- Org rows: visible only to members of that org.

-- categories
DROP POLICY IF EXISTS "auth_all_categories" ON public.categories;
DROP POLICY IF EXISTS "scoped_categories"   ON public.categories;
CREATE POLICY "scoped_categories" ON public.categories
  FOR ALL TO authenticated
  USING (
    org_id IS NULL
    OR org_id IN (SELECT public.get_my_org_ids())
  )
  WITH CHECK (
    org_id IS NULL
    OR org_id IN (SELECT public.get_my_org_ids())
  );

-- items
DROP POLICY IF EXISTS "auth_all_items" ON public.items;
DROP POLICY IF EXISTS "scoped_items"   ON public.items;
CREATE POLICY "scoped_items" ON public.items
  FOR ALL TO authenticated
  USING (
    org_id IS NULL
    OR org_id IN (SELECT public.get_my_org_ids())
  )
  WITH CHECK (
    org_id IS NULL
    OR org_id IN (SELECT public.get_my_org_ids())
  );

-- groups
DROP POLICY IF EXISTS "auth_all_groups" ON public.groups;
DROP POLICY IF EXISTS "scoped_groups"   ON public.groups;
CREATE POLICY "scoped_groups" ON public.groups
  FOR ALL TO authenticated
  USING (
    org_id IS NULL
    OR org_id IN (SELECT public.get_my_org_ids())
  )
  WITH CHECK (
    org_id IS NULL
    OR org_id IN (SELECT public.get_my_org_ids())
  );

-- logs
DROP POLICY IF EXISTS "auth_all_logs" ON public.logs;
DROP POLICY IF EXISTS "scoped_logs"   ON public.logs;
CREATE POLICY "scoped_logs" ON public.logs
  FOR ALL TO authenticated
  USING (
    org_id IS NULL
    OR org_id IN (SELECT public.get_my_org_ids())
  )
  WITH CHECK (
    org_id IS NULL
    OR org_id IN (SELECT public.get_my_org_ids())
  );

-- Bin policies remain unchanged (they filter on deleted_at)
