-- ============================================================
-- Upcycle Inventory — Supabase Schema + Seed Data
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  icon       TEXT        NOT NULL DEFAULT '📦',
  color      TEXT        NOT NULL DEFAULT '#D4537E',
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  category_id UUID        REFERENCES public.categories(id) ON DELETE SET NULL,
  stock       INTEGER     NOT NULL DEFAULT 0,
  image_url          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ,
  carbon_kg_per_item NUMERIC,
  carbon_kg_total    NUMERIC,
  carbon_summary     TEXT
);

CREATE TABLE IF NOT EXISTS public.groups (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  member_count INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID        NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  direction  TEXT        NOT NULL CHECK (direction IN ('in', 'out')),
  amount     INTEGER     NOT NULL CHECK (amount > 0),
  comment    TEXT,
  group_id   UUID        REFERENCES public.groups(id) ON DELETE SET NULL,
  condition  TEXT        CHECK (condition IN ('good', 'fair', 'poor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Stock auto-update trigger ────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_update_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.direction = 'in' THEN
    UPDATE public.items SET stock = stock + NEW.amount WHERE id = NEW.item_id;
  ELSE
    UPDATE public.items SET stock = stock - NEW.amount WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_stock ON public.logs;
CREATE TRIGGER trg_update_stock
  AFTER INSERT ON public.logs
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_stock();

-- ── Storage bucket ───────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('items', 'items', true)
ON CONFLICT (id) DO NOTHING;

-- ── Row Level Security ───────────────────────────────────────

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs       ENABLE ROW LEVEL SECURITY;

-- Authenticated users get full access (single-org app)
CREATE POLICY "auth_all_categories" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_items"      ON public.items      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_groups"     ON public.groups     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_logs"       ON public.logs       FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bin page: read / restore / hard-delete soft-deleted rows
-- (normal queries hide deleted rows via app-level deleted_at IS NULL filters;
--  these extra policies let the Bin page access them)
CREATE POLICY "bin_read_items"       ON public.items      FOR SELECT TO authenticated USING (deleted_at IS NOT NULL);
CREATE POLICY "bin_modify_items"     ON public.items      FOR UPDATE TO authenticated USING (deleted_at IS NOT NULL) WITH CHECK (true);
CREATE POLICY "bin_delete_items"     ON public.items      FOR DELETE TO authenticated USING (deleted_at IS NOT NULL);
CREATE POLICY "bin_read_categories"  ON public.categories FOR SELECT TO authenticated USING (deleted_at IS NOT NULL);
CREATE POLICY "bin_modify_categories" ON public.categories FOR UPDATE TO authenticated USING (deleted_at IS NOT NULL) WITH CHECK (true);
CREATE POLICY "bin_delete_categories" ON public.categories FOR DELETE TO authenticated USING (deleted_at IS NOT NULL);

CREATE POLICY "storage_items_read"   ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'items');
CREATE POLICY "storage_items_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'items');
CREATE POLICY "storage_items_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'items');

-- ── Seed: Categories ─────────────────────────────────────────

INSERT INTO public.categories (id, name, icon, color) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Furniture', '🪑', '#8B5CF6'),
  ('11111111-0000-0000-0000-000000000002', 'Kitchen',   '🍽️', '#F59E0B'),
  ('11111111-0000-0000-0000-000000000003', 'Beddings',  '🛏️', '#3B82F6'),
  ('11111111-0000-0000-0000-000000000004', 'Office',    '💼', '#10B981'),
  ('11111111-0000-0000-0000-000000000005', 'Other',     '📦', '#6B7280'),
  ('11111111-0000-0000-0000-000000000006', 'Bikes',     '🚲', '#EF4444')
ON CONFLICT (id) DO NOTHING;

-- ── Seed: Items ──────────────────────────────────────────────

INSERT INTO public.items (id, name, description, category_id, stock) VALUES
  ('22222222-0000-0000-0000-000000000001', 'Chair',            'Standard stackable chairs',  '11111111-0000-0000-0000-000000000001', 31),
  ('22222222-0000-0000-0000-000000000002', 'Office Chair',     'Adjustable office chairs',   '11111111-0000-0000-0000-000000000004',  8),
  ('22222222-0000-0000-0000-000000000003', 'Sofa',             'Two-seater sofas',            '11111111-0000-0000-0000-000000000001',  7),
  ('22222222-0000-0000-0000-000000000004', 'Small Side Table', 'Compact side tables',         '11111111-0000-0000-0000-000000000001',  3),
  ('22222222-0000-0000-0000-000000000005', 'Table',            'Dining and work tables',      '11111111-0000-0000-0000-000000000001', 16),
  ('22222222-0000-0000-0000-000000000006', 'Plate',            'Ceramic dinner plates',       '11111111-0000-0000-0000-000000000002', 211),
  ('22222222-0000-0000-0000-000000000007', 'Bowl',             'Assorted mixing bowls',       '11111111-0000-0000-0000-000000000002', 69),
  ('22222222-0000-0000-0000-000000000008', 'Glass',            'Drinking glasses',            '11111111-0000-0000-0000-000000000002', 188),
  ('22222222-0000-0000-0000-000000000009', 'Mug',              'Coffee and tea mugs',         '11111111-0000-0000-0000-000000000002', 111)
ON CONFLICT (id) DO NOTHING;

-- ── Seed: Groups ─────────────────────────────────────────────

INSERT INTO public.groups (id, name, member_count) VALUES
  ('33333333-0000-0000-0000-000000000001', 'Engineering Society', 42),
  ('33333333-0000-0000-0000-000000000002', 'Architecture Dept.',  28),
  ('33333333-0000-0000-0000-000000000003', 'Design Lab',          15),
  ('33333333-0000-0000-0000-000000000004', 'Newcomers 2025',      67)
ON CONFLICT (id) DO NOTHING;

-- ── Seed: Sample Logs ────────────────────────────────────────
-- Note: Insert logs AFTER the trigger is set; do NOT also update stock manually.

INSERT INTO public.logs (item_id, direction, amount, group_id, condition, comment) VALUES
  ('22222222-0000-0000-0000-000000000001', 'out', 4, '33333333-0000-0000-0000-000000000001', 'good',  'For end-of-year event'),
  ('22222222-0000-0000-0000-000000000006', 'out', 20,'33333333-0000-0000-0000-000000000004', 'good',  'Welcome dinner'),
  ('22222222-0000-0000-0000-000000000008', 'out', 12,'33333333-0000-0000-0000-000000000003', 'fair',  'Design workshop'),
  ('22222222-0000-0000-0000-000000000001', 'in',  2, NULL,                                   'fair',  'Returned after event'),
  ('22222222-0000-0000-0000-000000000007', 'out', 5, '33333333-0000-0000-0000-000000000002', 'good',  'Studio kitchen');
