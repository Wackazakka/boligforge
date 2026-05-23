-- ============================================================
-- ReelHome — Initial Schema
-- Prosjekt: jvnavubholyvihvytqkn
-- Idempotent: trygt å kjøre flere ganger
-- ============================================================


-- ------------------------------------------------------------
-- 1. ORGANIZATIONS — meglerhus
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL,
  slug                   text UNIQUE NOT NULL,
  logo_url               text,
  plan                   text NOT NULL DEFAULT 'free',
  stripe_customer_id     text,
  stripe_subscription_id text,
  trial_ends_at          timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- Policy opprettes etter profiles-tabellen (se lenger ned)


-- ------------------------------------------------------------
-- 2. PROFILES — meglere
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  organization_id  uuid REFERENCES organizations ON DELETE SET NULL,
  full_name        text,
  role             text NOT NULL DEFAULT 'agent'
                     CHECK (role IN ('admin', 'agent')),
  avatar_url       text,
  voice_clone_id   text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_org_idx  ON profiles (organization_id);
CREATE INDEX IF NOT EXISTS profiles_user_idx ON profiles (id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Organizations-policy som avhenger av profiles
DROP POLICY IF EXISTS "org: admin read own" ON organizations;
CREATE POLICY "org: admin read own"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "profiles: read own"       ON profiles;
DROP POLICY IF EXISTS "profiles: admin read org" ON profiles;
DROP POLICY IF EXISTS "profiles: update own"     ON profiles;

CREATE POLICY "profiles: read own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles: admin read org"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS me
      WHERE me.id = auth.uid()
        AND me.organization_id = profiles.organization_id
        AND me.role = 'admin'
    )
  );

CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE
  USING (id = auth.uid());


-- ------------------------------------------------------------
-- 3. CREDITS — videokreditter per org
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  total            int NOT NULL DEFAULT 0,
  used             int NOT NULL DEFAULT 0,
  reset_at         timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS credits_org_unique ON credits (organization_id);

ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credits: read own org"  ON credits;
DROP POLICY IF EXISTS "credits: admin update"  ON credits;

CREATE POLICY "credits: read own org"
  ON credits FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "credits: admin update"
  ON credits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND organization_id = credits.organization_id
        AND role = 'admin'
    )
  );


-- ------------------------------------------------------------
-- 4. PRODUCTION_JOBS — produksjonsjobber
-- Tabellen finnes fra før (ContentForge) med annet schema.
-- Legger til manglende kolonner uten å røre eksisterende data.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS production_jobs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status     text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Legg til ReelHome-kolonner dersom de mangler
ALTER TABLE production_jobs ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations ON DELETE CASCADE;
ALTER TABLE production_jobs ADD COLUMN IF NOT EXISTS profile_id      uuid REFERENCES profiles ON DELETE SET NULL;
ALTER TABLE production_jobs ADD COLUMN IF NOT EXISTS property_url    text;
ALTER TABLE production_jobs ADD COLUMN IF NOT EXISTS output_url      text;
ALTER TABLE production_jobs ADD COLUMN IF NOT EXISTS metadata        jsonb;

CREATE INDEX IF NOT EXISTS jobs_org_idx     ON production_jobs (organization_id);
CREATE INDEX IF NOT EXISTS jobs_profile_idx ON production_jobs (profile_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx  ON production_jobs (status);

ALTER TABLE production_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs: agent read own" ON production_jobs;
DROP POLICY IF EXISTS "jobs: admin read org" ON production_jobs;
DROP POLICY IF EXISTS "jobs: insert own"     ON production_jobs;
DROP POLICY IF EXISTS "jobs: update own"     ON production_jobs;

CREATE POLICY "jobs: agent read own"
  ON production_jobs FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "jobs: admin read org"
  ON production_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND organization_id = production_jobs.organization_id
        AND role = 'admin'
    )
  );

CREATE POLICY "jobs: insert own"
  ON production_jobs FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "jobs: update own"
  ON production_jobs FOR UPDATE
  USING (profile_id = auth.uid());
