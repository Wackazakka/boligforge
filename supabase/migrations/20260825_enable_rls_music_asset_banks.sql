-- Sikkerhetsfiks 2026-08-25: RLS manglet på to tabeller i ReelHome-prosjektet
-- (jvnavubholyvihvytqkn). Supabase security advisor: rls_disabled_in_public
-- + policy_exists_rls_disabled.
--
-- Uten RLS ga PostgREST anon-nøkkelen (åpen i frontend-JS) full lese- og
-- skrivetilgang til begge tabellene. Verifisert 25.08.2026.

-- ---------------------------------------------------------------------------
-- music_files: KAN IKKE deny-all. Opplasting går via anon-nøkkel + session.
-- ---------------------------------------------------------------------------
-- Tilgangsanalyse (app/api/music/):
--   GET    → getServiceClient()            = service_role, omgår RLS   ✓
--   DELETE → getServiceClient()            = service_role, omgår RLS   ✓
--   upload → createSupabaseServerClient()  = ANON-nøkkel + brukerens
--            session ⇒ RLS GJELDER. Trenger INSERT-policy, ellers dør
--            musikkopplasting.
-- SELECT-policyen er også nødvendig: upload gjør .insert().select('id'),
-- og RETURNING krever SELECT-rettighet på den nye raden — uten den blir
-- `row.id` null og frontend mister muligheten til å slette sporet igjen.
-- Ingen UPDATE/DELETE-policy: sletting går uansett via service_role.

ALTER TABLE public.music_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brukere laster opp egne spor"
  ON public.music_files FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Brukere ser egne spor"
  ON public.music_files FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- asset_banks: foreldreløs ContentForge-tabell. Ren RLS-aktivering.
-- ---------------------------------------------------------------------------
-- Tabellen har allerede 3 policyer (SELECT/INSERT/UPDATE) — de har bare vært
-- inaktive fordi RLS var av. Å skru på RLS aktiverer den tilsiktede
-- oppførselen; det legges ikke til noe nytt.
-- Trygt fordi: ContentForge flyttet til eget prosjekt (wxnevywhtmovangkobal),
-- der asset_banks allerede kjører med RLS på + samme policyer, med 996 rader
-- og aktivitet så sent som 24.08.2026. Kopien her har stått urørt siden
-- 08.06.2026 (587 rader) — ingen app skriver til den lenger.

ALTER TABLE public.asset_banks ENABLE ROW LEVEL SECURITY;
