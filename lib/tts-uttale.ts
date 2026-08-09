/**
 * Uttalefiks før tekst sendes til ElevenLabs.
 *
 * Noen norske ord leses konsekvent feil av stemmemotoren. Løsningen har vært at
 * megleren selv staver om i manuset — men da står feilstavingen i teksten han
 * leser og redigerer, og han må huske det på nytt for hver video.
 *
 * Derfor: manuset beholder riktig skrivemåte, og omskrivingen skjer KUN på vei
 * inn i TTS-kallet. Brukeren ser «elleve», stemmen sier «ellve».
 *
 * VIKTIG: samme liste finnes i worker-ens scraper.js (fiksUttale), fordi den
 * ferdige videoens lyd genereres der, mens forhåndsvisningene går gjennom
 * webappen. Endrer du her, endre der òg.
 */
export const UTTALE: Array<[RegExp, string]> = [
  // «elleve» blir lest med tydelig e mellom l-ene; «ellve» treffer norsk uttale.
  [/\belleve\b/gi, 'ellve'],
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
