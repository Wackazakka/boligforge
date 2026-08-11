/**
 * Nedlasting av ferdige videoer — delt mellom boligsiden og mappene.
 *
 * To ting som begge har blitt oppdaget som feil i produksjon:
 *
 * 1. `<a download>` IGNORERES på tvers av domener. R2-lenkene er et annet
 *    domene, så attributtet ga «åpne i ny fane» i stedet for nedlasting.
 *    Derfor hentes fila gjennom same-origin-proxyen /r2/* (netlify.toml) og
 *    lastes ned som blob.
 * 2. Filnavnet var «presentasjon.mp4» — ubrukelig i nedlastingsmappa til en
 *    megler med tjue boliger.
 */

/** «Bjørndalveien 11 A, 1708, Sarpsborg» + 16x9 → bjoerndalveien-11-a-1708-sarpsborg-16x9.mp4 */
export function videoFilnavn(adresse: string | null | undefined, format: '16x9' | '9x16' | '1x1') {
  const base = (adresse || 'presentasjon')
    .toLowerCase()
    // ae/oe/aa framfor å strippe: filnavn reiser mellom Mac, Windows og
    // e-postvedlegg, og der er ASCII fortsatt tryggest.
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return `${base || 'presentasjon'}-${format}.mp4`
}

export async function lastNedVideo(url: string, filnavn: string) {
  try {
    const proxied = url.replace(/^https:\/\/pub-[a-z0-9]+\.r2\.dev\//, '/r2/')
    const res = await fetch(proxied)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filnavn
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  } catch {
    window.open(url, '_blank')
  }
}
