-- ReelHome — egen byrå-toggle for foto-avatar (D-ID). Standard PÅ.
alter table public.organizations
  add column if not exists allow_did boolean not null default true;
