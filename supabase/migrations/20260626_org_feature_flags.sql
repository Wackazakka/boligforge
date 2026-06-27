-- ReelHome — byrå-styrte funksjonsflagg. Byråsjef (organization_members.role =
-- 'admin') skrur de betalte funksjonene av/på for hele byrået. Standard PÅ.

alter table public.organizations
  add column if not exists allow_liveavatar boolean not null default true,
  add column if not exists allow_pvc        boolean not null default true;
