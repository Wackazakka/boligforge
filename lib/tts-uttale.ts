/**
 * Uttalefiks før tekst sendes til ElevenLabs — ÉN liste for hele webappen.
 *
 * Noen norske ord leses konsekvent feil av stemmemotoren. Løsningen har vært at
 * megleren selv staver om i manuset — men da står feilstavingen i teksten han
 * leser og redigerer, og han må huske det på nytt for hver video.
 *
 * Derfor: manuset beholder riktig skrivemåte, og omskrivingen skjer KUN på vei
 * inn i TTS-kallet. Brukeren ser «førti», stemmen sier «førtti».
 *
 * VIKTIG: samme liste finnes i worker-ens scraper.js (fiksUttale), fordi den
 * ferdige videoens lyd genereres der, mens forhåndsvisningene går gjennom
 * webappen. Endrer du her, endre der òg.
 */

/**
 * Mønstrene bruker ordgrense bare i STARTEN, ikke slutten. Grunnen er
 * sammensatte tallord: etter at vi gikk over til moderne bokmål heter 46
 * «førtiseks», ett ord — en `\bførti\b` ville sluttet å treffe, som den gjorde
 * da formen ble lagt om (målt 11/8: «46» ble lest med myk t).
 */
export const UTTALE: Array<[RegExp, string]> = [
  // 40 — trenger hard dobbel-T («hoppe», ikke «hope»). Treffer også
  // «førtiseks», «førtiåtte», «førtiende».
  [/\bførti/gi, 'førtti'],
  // 16 — leses ellers «seks-ten» med trykk på feil stavelse.
  [/\bseksten/gi, 'seisten'],
  // 11 — leses med tydelig e mellom l-ene.
  [/\belleve/gi, 'ellve'],
]

/** Bytter ut ord stemmemotoren uttaler feil. Bevarer stor forbokstav. */
export function fiksUttale(text: string): string {
  if (!text) return text
  let ut = text
  for (const [moenster, erstatning] of UTTALE) {
    ut = ut.replace(moenster, treff =>
      treff[0] === treff[0].toUpperCase()
        ? erstatning[0].toUpperCase() + erstatning.slice(1)
        : erstatning,
    )
  }
  return ut
}
