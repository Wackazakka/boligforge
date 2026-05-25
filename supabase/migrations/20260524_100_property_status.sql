-- Add status + sold_at to properties
alter table public.properties
  add column if not exists status   text        not null default 'active'
                                    check (status in ('active','sold')),
  add column if not exists sold_at  timestamptz;
