/**
 * Er betaling åpnet? Stripe står i TESTMODUS i prod, så enhver vei til
 * checkout ender på en betalingsside stemplet TEST MODE — verre for en kunde
 * enn ingen knapp i det hele tatt.
 *
 * Sett true SAMTIDIG som live-nøklene legges inn i Netlify (secret key,
 * publishable key, webhook secret og de tre pris-ID-ene). Ingen annen kode må
 * endres: prisene, checkout-ruta og webhooken står urørt.
 */
export const BETALING_AAPEN = false
