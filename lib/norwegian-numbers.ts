// Norsk tall-til-ord for TTS — delt mellom video-manus (generate-script) og
// avatar-tale (avatar/ask). ElevenLabs leser sifre upålitelig på norsk;
// ord uttales alltid riktig.

const ONES = ['', 'én', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni',
               'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten',
               'sytten', 'atten', 'nitten']
const TENS = ['', '', 'tjue', 'tretti', 'førti', 'femti', 'seksti', 'sytti', 'åtti', 'nitti']

// below1000 med konfigurerbar separator (bindestreker hjelper TTS-rytmen)
export function below1000(n: number, tensSep = '-', hundredSep = '-og-'): string {
  if (n === 0) return ''
  if (n < 20) return ONES[n]
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)]
    const o = n % 10
    return o === 0 ? t : `${t}${tensSep}${ONES[o]}`
  }
  const h = Math.floor(n / 100)
  const rest = n % 100
  const hStr = h === 1 ? 'ett-hundre' : `${ONES[h]}-hundre`
  return rest === 0 ? hStr : `${hStr}${hundredSep}${below1000(rest, tensSep, hundredSep)}`
}

export function numberToNorwegian(num: number): string {
  if (!Number.isFinite(num)) return String(num)
  if (num === 0) return 'null'
  const mill = Math.floor(num / 1_000_000)
  const thou = Math.floor((num % 1_000_000) / 1_000)
  const rest = num % 1_000
  const parts: string[] = []
  if (mill > 0) parts.push(mill === 1 ? 'én million' : `${below1000(mill)} millioner`)
  if (thou > 0) parts.push(thou === 1 ? 'tusen' : `${below1000(thou)} tusen`)
  if (rest > 0) parts.push(below1000(rest))
  return parts.join(' ')
}

// "ti millioner fire hundre-og-nitti tusen kroner"
export function priceToNorwegian(num: number): string {
  if (!num || isNaN(num)) return ''
  return `${numberToNorwegian(num)} kroner`
}

// "to-hundre-og-åtti-fem" — helt bindestreket for TTS
export function sizeToNorwegian(num: number): string {
  if (!num || isNaN(num)) return String(num)
  const n = Math.round(num)
  if (n < 1000) return below1000(n, '', '-og-')
  return String(n)
}

function yearToNorwegian(y: number): string {
  if (y >= 1900 && y < 2000) return `nitten ${below1000(y % 100) || 'hundre'}`
  if (y >= 2000 && y < 2100) return y % 100 === 0 ? 'to tusen' : `to tusen og ${below1000(y % 100)}`
  return numberToNorwegian(y)
}

const ORDINALS = ['', 'første', 'andre', 'tredje', 'fjerde', 'femte', 'sjette', 'sjuende',
                  'åttende', 'niende', 'tiende', 'ellevte', 'tolvte', 'trettende', 'fjortende', 'femtende']

// Postnummer leses parvis på norsk: 1275 -> «tolv syttifem», 0563 -> «null fem sekstitre»
function postalCodeToNorwegian(code: string): string {
  const a = Number(code.slice(0, 2))
  const b = Number(code.slice(2))
  const first = a === 0 ? 'null null' : a < 10 ? `null ${below1000(a)}` : below1000(a)
  if (b === 0) return `${first} hundre`
  const second = b < 10 ? `null ${below1000(b)}` : below1000(b)
  return `${first} ${second}`
}

// Vask en hel svartekst til taleform: tall, TG-koder, enheter.
// Brukes på avatar-svar FØR repeat() — chat-visningen beholder originalen.
export function speakifyForTTS(text: string): string {
  let s = text

  // ordenstall foran etasje: «1. etasjen» -> «første etasjen»
  s = s.replace(/\b(\d{1,2})\.\s*(etasje\w*|etg\.?)/gi, (_m, d, e) => {
    const ord = ORDINALS[Number(d)]
    return ord ? `${ord} ${/etg/i.test(e) ? 'etasje' : e}` : _m
  })

  // postnummer (fire siffer foran stedsnavn) leses parvis — FØR årstallsregelen,
  // så «2010 Strømmen» blir «tjue ti», ikke «to tusen og ti»
  s = s.replace(/\b(\d{4})\b(?=,?\s+[A-ZÆØÅ][a-zæøå])/g, m => postalCodeToNorwegian(m))

  // TG-koder -> naturlig norsk
  s = s.replace(/\bTG\s?-?IU\b/gi, 'tilstandsgrad ikke undersøkt')
  s = s.replace(/\bTG\s?-?([0-3])\b/gi, (_, d) => `tilstandsgrad ${ONES[Number(d)] || d}`)

  // enheter
  s = s.replace(/\bm²|\bm2\b|\bkvm\b/g, 'kvadratmeter')
  s = s.replace(/(\d)\s*%/g, '$1 prosent')
  s = s.replace(/\bkr\.?(?=\s|$)/g, 'kroner')

  // tallintervaller «250 000 – 500 000» -> «… til …»
  s = s.replace(/(\d[\d  .]*\d|\d)\s*[–—-]\s*(?=\d)/g, '$1 til ')

  // desimaltall «1,5» -> «én komma fem»
  s = s.replace(/\b(\d+),(\d+)\b/g, (_, a, b) =>
    `${numberToNorwegian(Number(a))} komma ${String(b).split('').map(d => d === '0' ? 'null' : ONES[Number(d)]).join(' ')}`)

  // tall med tusenskilletegn «8 900 000» / «8.900.000»
  s = s.replace(/\b\d{1,3}(?:[  .]\d{3})+\b/g, m => numberToNorwegian(Number(m.replace(/[  .]/g, ''))))

  // årstall
  s = s.replace(/\b(19|20)\d{2}\b/g, m => yearToNorwegian(Number(m)))

  // gjenværende heltall
  s = s.replace(/\b\d+\b/g, m => (m.length <= 9 ? numberToNorwegian(Number(m)) : m))

  // Fonetisk omskriving: ord ElevenLabs uttaler feil på norsk staves om til en
  // stavemåte som uttales riktig. Påvirker KUN TTS-en — transkripsjonen viser
  // fortsatt original tekst. Utvides etter hvert som vi hører flere feil.
  for (const [word, phonetic] of Object.entries(RESPELL)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, 'gi'), phonetic)
  }

  return s
}

const RESPELL: Record<string, string> = {
  seksten: 'seisten', // 16 — uttales ellers «seks-ten» med feil trykk
}
