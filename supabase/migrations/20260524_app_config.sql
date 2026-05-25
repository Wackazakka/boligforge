-- app_config: key-value store for global application configuration
create table if not exists public.app_config (
  key   text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Only service-role can write; anon/authenticated can read
alter table public.app_config enable row level security;

create policy "service role full access"
  on public.app_config
  using (true)
  with check (true);
