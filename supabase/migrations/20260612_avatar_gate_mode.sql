-- Avatar kjøper-port (Spor C): megler velger hvor mye kjøper må oppgi for tilgang.
--   consent  = kun GDPR-samtykke (lavest friksjon)
--   contact  = navn + e-post + telefon + samtykke (lead)
--   viewing  = kontaktinfo + påmelding til visning (sterkest)
alter table reelhome_avatar_config
  add column if not exists gate_mode text not null default 'contact'
  check (gate_mode in ('consent', 'contact', 'viewing'));
