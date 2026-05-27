-- Add account_type to profiles
-- Values: 'solo' (independent agent), 'team_admin' (creates/owns an org), 'team_member' (invited agent)
-- NULL means the user has not completed onboarding yet

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text
    CHECK (account_type IN ('solo', 'team_admin', 'team_member'));

COMMENT ON COLUMN public.profiles.account_type IS
  'solo = freelance/independent; team_admin = runs an org; team_member = invited agent';
