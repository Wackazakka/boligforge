-- Instagram Business Account ID linked to a Facebook Page connection.
-- Populated during Facebook OAuth callback when a Page has a connected IG account.
alter table public.social_connections
  add column if not exists instagram_user_id text;
