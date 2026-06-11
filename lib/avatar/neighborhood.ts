// Nabolagsfakta fra norske åpne data (Fase 1-utvidelse, 2026-06-11):
// adresse -> Kartverket (koordinater) -> Entur (nærmeste kollektivstopp m/ avstand).
// Samme primærkilder som Finn-annonsenes nabolagsprofil bygger på — gratis og åpne.
// Beregnes én gang per eiendom og lagres i properties.neighborhood_facts.

const CATEGORY_LABELS: [RegExp, string][] = [
  [/bus/i, 'bussholdeplass'],
  [/ferry|harbourPort/i, 'fergeleie'],
  [/rail/i, 'togstasjon'],
  [/tram/i, 'trikkeholdeplass'],
  [/metro/i, 't-banestasjon'],
]

export async function fetchNeighborhoodFacts(address: string): Promise<string | null> {
  try {
    // 1) Kartverket: adresse -> koordinater
    const geoRes = await fetch(
      `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(address)}&treffPerSide=1`,
      { signal: AbortSignal.timeout(8000) }
    )
    const geo = await geoRes.json()
    const punkt = geo?.adresser?.[0]?.representasjonspunkt
    if (!punkt?.lat || !punkt?.lon) return null

    // 2) Entur: nærmeste kollektivstopp (distance er i kilometer)
    const enturRes = await fetch(
      `https://api.entur.io/geocoder/v1/reverse?point.lat=${punkt.lat}&point.lon=${punkt.lon}&size=15&layers=venue`,
      { headers: { 'ET-Client-Name': 'reelhome-avatar' }, signal: AbortSignal.timeout(8000) }
    )
    const entur = await enturRes.json()
    const features: { properties?: { name?: string; distance?: number; category?: string[] } }[] =
      entur?.features ?? []

    // nærmeste stopp per kategori, innen 3 km
    const nearest = new Map<string, { name: string; meters: number }>()
    for (const f of features) {
      const p = f.properties
      if (!p?.name || p.distance == null) continue
      const meters = Math.round((p.distance * 1000) / 10) * 10
      if (meters > 3000) continue
      const cats = p.category ?? []
      for (const [re, label] of CATEGORY_LABELS) {
        if (cats.some(c => re.test(c)) && !nearest.has(label)) {
          nearest.set(label, { name: p.name, meters })
        }
      }
    }
    if (nearest.size === 0) return null

    const lines = [...nearest.entries()].map(([label, s]) => {
      const gange = Math.max(1, Math.round(s.meters / 80)) // ~80 m/min gange
      return `Nærmeste ${label}: ${s.name}, ca. ${s.meters} meter (${gange} min gange)`
    })
    return lines.join('\n')
  } catch (e) {
    console.error('[neighborhood] oppslag feilet:', e)
    return null
  }
}
