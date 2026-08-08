-- Kjørt live 2026-08-08 via management-API.
-- voice_sample_url: stemmeprøven lagres i R2 slik at en klone kan gjenskapes
--   på en ANNEN ElevenLabs-konto uten at megleren må gjøre nytt opptak
--   (stemmeplasser har hardt tak per konto: Scale/Business = 660).
-- elevenlabs_account: hvilken konto stemmen faktisk bor på — TTS må bruke
--   nøkkelen til samme konto.
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS voice_sample_url text;
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS elevenlabs_account text;
NOTIFY pgrst, 'reload schema';
