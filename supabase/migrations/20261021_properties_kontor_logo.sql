-- 2026-10-21: Kontorets logo per BOLIG, hentet fra annonsen på hjem.no.
-- Bakgrunn: i hjem.no-modellen lager Hjem.nos produsenter videoer for mange
-- kontorer fra én konto, så sluttplakatens logo kan ikke lenger komme fra
-- kontoen som lager videoen. Rekkefølge ved generering: kontoens egen logo
-- (kjede → kontor → personlig) vinner; finnes ingen, brukes kontorlogoen fra
-- annonsen. Fylles lat (første gang den trengs) av lib/kontorlogo.ts.

alter table public.properties
  add column if not exists kontor_logo_url text,
  add column if not exists kontor_navn text;
