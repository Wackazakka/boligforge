-- 2026-10-21: Fakturakunde (Hjem.no-modellen). Hjem.no produserer selv for alle
-- meglere fra én organisasjon med flere produsenter og én administrator, og
-- betaler en flat pris per bolig etterskuddsvis (faktura) eller med kort.
-- For en fakturakunde låses boligen opp automatisk når den tas i bruk
-- (første nedlasting), uten gratisbolig, saldo eller kjøp — kilden blir
-- 'faktura' med organisasjonens pris, og Team-siden viser kostnaden per måned.
-- Publisering og kalender skjules for medlemmene (de publiserer i eget system).

alter table public.organizations
  add column if not exists faktura_kunde boolean not null default false,
  add column if not exists pris_per_bolig_nok integer;

alter table public.property_unlocks drop constraint if exists property_unlocks_source_check;
alter table public.property_unlocks
  add constraint property_unlocks_source_check
  check (source in ('free_first', 'entitlement', 'purchase', 'production', 'admin', 'faktura'));

-- Hjem.no-organisasjonen (Nina Hareide-Larsen er administrator, opprettet 19/8):
update public.organizations
   set faktura_kunde = true, pris_per_bolig_nok = 500, faktura_samlet = true
 where id = '98593b76-ad83-4510-b4b1-ee3fe4eb3bc8';
