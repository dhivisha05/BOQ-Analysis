-- FlyAI vendors table compatibility fix
-- Run this in Supabase SQL Editor on the target project.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendors'
  ) THEN
    CREATE TABLE public.vendors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      company_name TEXT NOT NULL,
      contact_person TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      location TEXT DEFAULT '',
      categories TEXT[] DEFAULT ARRAY[]::TEXT[],
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    ALTER TABLE public.vendors
      ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
      ADD COLUMN IF NOT EXISTS user_id UUID,
      ADD COLUMN IF NOT EXISTS company_name TEXT,
      ADD COLUMN IF NOT EXISTS contact_person TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT ARRAY[]::TEXT[],
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END
$$;

DO $$
DECLARE
  categories_type TEXT;
BEGIN
  SELECT udt_name
  INTO categories_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'categories';

  IF categories_type = 'text' THEN
    EXECUTE $sql$
      ALTER TABLE public.vendors
      ALTER COLUMN categories TYPE TEXT[]
      USING CASE
        WHEN categories IS NULL OR btrim(categories) = '' THEN ARRAY[]::TEXT[]
        ELSE regexp_split_to_array(categories, '\s*[,;/]\s*')
      END
    $sql$;
  ELSIF categories_type = 'jsonb' THEN
    EXECUTE $sql$
      ALTER TABLE public.vendors
      ALTER COLUMN categories TYPE TEXT[]
      USING CASE
        WHEN categories IS NULL THEN ARRAY[]::TEXT[]
        ELSE ARRAY(SELECT jsonb_array_elements_text(categories))
      END
    $sql$;
  END IF;
END
$$;

-- Backfill from common legacy keys.
UPDATE public.vendors v
SET company_name = COALESCE(
  NULLIF(v.company_name, ''),
  NULLIF(to_jsonb(v)->>'company', ''),
  NULLIF(to_jsonb(v)->>'name', ''),
  NULLIF(to_jsonb(v)->>'vendor_name', '')
)
WHERE v.company_name IS NULL OR v.company_name = '';

UPDATE public.vendors v
SET contact_person = COALESCE(
  NULLIF(v.contact_person, ''),
  NULLIF(to_jsonb(v)->>'contact_name', ''),
  NULLIF(to_jsonb(v)->>'person', '')
)
WHERE v.contact_person IS NULL OR v.contact_person = '';

UPDATE public.vendors v
SET email = COALESCE(
  NULLIF(v.email, ''),
  NULLIF(to_jsonb(v)->>'mail', '')
)
WHERE v.email IS NULL OR v.email = '';

UPDATE public.vendors v
SET phone = COALESCE(
  NULLIF(v.phone, ''),
  NULLIF(to_jsonb(v)->>'mobile', '')
)
WHERE v.phone IS NULL OR v.phone = '';

UPDATE public.vendors v
SET location = COALESCE(
  NULLIF(v.location, ''),
  NULLIF(to_jsonb(v)->>'city', ''),
  NULLIF(to_jsonb(v)->>'address', '')
)
WHERE v.location IS NULL OR v.location = '';

UPDATE public.vendors v
SET status = COALESCE(
  NULLIF(v.status, ''),
  CASE
    WHEN lower(COALESCE(to_jsonb(v)->>'is_active', '')) IN ('false', '0', 'no') THEN 'inactive'
    WHEN lower(COALESCE(to_jsonb(v)->>'is_active', '')) IN ('true', '1', 'yes') THEN 'active'
    ELSE NULL
  END,
  'active'
)
WHERE v.status IS NULL OR v.status = '';

UPDATE public.vendors v
SET categories = ARRAY[]::TEXT[]
WHERE v.categories IS NULL;

UPDATE public.vendors v
SET categories = regexp_split_to_array(
  COALESCE(
    NULLIF(to_jsonb(v)->>'category', ''),
    NULLIF(to_jsonb(v)->>'trade', '')
  ),
  '\s*[,;/]\s*'
)
WHERE COALESCE(array_length(v.categories, 1), 0) = 0
  AND COALESCE(
    NULLIF(to_jsonb(v)->>'category', ''),
    NULLIF(to_jsonb(v)->>'trade', '')
  ) IS NOT NULL;

UPDATE public.vendors
SET id = gen_random_uuid()
WHERE id IS NULL;

UPDATE public.vendors v
SET updated_at = COALESCE(v.updated_at, v.created_at, NOW())
WHERE v.updated_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'owner_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.vendors v
      SET user_id = NULLIF(to_jsonb(v)->>'owner_id', '')
      WHERE v.user_id IS NULL
        AND (to_jsonb(v)->>'owner_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'workspace_owner_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.vendors v
      SET user_id = NULLIF(to_jsonb(v)->>'workspace_owner_id', '')
      WHERE v.user_id IS NULL
        AND (to_jsonb(v)->>'workspace_owner_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'vendors'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.vendors_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendors_set_updated_at_trigger ON public.vendors;

CREATE TRIGGER vendors_set_updated_at_trigger
BEFORE UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.vendors_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_vendors_user_id
  ON public.vendors (user_id);

CREATE INDEX IF NOT EXISTS idx_vendors_company_name
  ON public.vendors (company_name);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vendors' AND policyname = 'Users can view own vendors'
  ) THEN
    CREATE POLICY "Users can view own vendors"
      ON public.vendors
      FOR SELECT
      USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vendors' AND policyname = 'Users can insert own vendors'
  ) THEN
    CREATE POLICY "Users can insert own vendors"
      ON public.vendors
      FOR INSERT
      WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vendors' AND policyname = 'Users can update own vendors'
  ) THEN
    CREATE POLICY "Users can update own vendors"
      ON public.vendors
      FOR UPDATE
      USING (auth.uid() = user_id OR user_id IS NULL)
      WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vendors' AND policyname = 'Users can delete own vendors'
  ) THEN
    CREATE POLICY "Users can delete own vendors"
      ON public.vendors
      FOR DELETE
      USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END
$$;

COMMIT;
