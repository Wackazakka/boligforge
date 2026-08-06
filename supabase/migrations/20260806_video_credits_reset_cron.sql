-- Månedlig nullstilling av videokvoten (video_credits.used_this_month).
--
-- Denne pg_cron-jobben KJØRER ALLEREDE i Supabase-prosjektet (jvnavubholyvihvytqkn),
-- men var aldri sjekket inn i repoet — denne filen dokumenterer den og gjør den
-- reproduserbar. cron.schedule() med samme jobbnavn erstatter eksisterende jobb,
-- så migrasjonen er idempotent.
--
-- Kjøres 00:00 UTC den 1. hver måned. extra_credits nullstilles IKKE — de er
-- kjøpt (topup) og ruller over. reset_at har default
-- date_trunc('month', now()) + interval '1 month' på nye rader.

select cron.schedule(
  'reset-video-credits',
  '0 0 1 * *',
  $$UPDATE video_credits SET used_this_month = 0, reset_at = date_trunc('month', now()) + interval '1 month' WHERE reset_at < now()$$
);
