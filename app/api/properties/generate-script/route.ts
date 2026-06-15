import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { priceToNorwegian, sizeToNorwegian } from '../../../../lib/norwegian-numbers'

const getClient = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: Request) {
  try {
    const { property, agentProfile, scriptStyle } = await request.json()

    const styleDescriptions: Record<string, string> = {
      neutral: agentProfile?.tone_of_voice || 'profesjonell og engasjert',
      luxury:  'eksklusiv, sofistikert og prestisjefylt. Vektlegg unike detaljer, premium materialer og eksklusiv beliggenhet',
      family:  'varm, inkluderende og praktisk. Vektlegg plass, nærhet til skoler/barnehager, trygt nabolag og familievennlige løsninger',
      young:   'frisk, moderne og jordnær. Snakk til førstegangskjøpere, vektlegg tilgjengelighet, smart planløsning og gode transportmuligheter',
    }
    const tone = styleDescriptions[scriptStyle ?? 'neutral'] ?? styleDescriptions.neutral

    const propertyDetails = [
      property.title && `Tittel: ${property.title}`,
      property.address && `Adresse: ${property.address}`,
      property.price && `Prisantydning: ${priceToNorwegian(Number(property.price))}`,
      property.price_total && `Totalpris inkl. omk.: ${priceToNorwegian(Number(property.price_total))}`,
      property.shared_debt && `Fellesgjeld: ${priceToNorwegian(Number(property.shared_debt))}`,
      property.shared_costs && `Felleskostnader: ja (beskriv som lave/moderate/rimelige basert på skjønn)`,
      property.size_bra && `Størrelse: ${sizeToNorwegian(Number(property.size_bra))} kvadratmeter`,
      property.rooms && `Rom: ${property.rooms}`,
      property.bedrooms && `Soverom: ${property.bedrooms}`,
      property.floor && `Etasje: ${property.floor}`,
      property.build_year && `Byggeår: ${property.build_year}`,
      property.property_type && `Boligtype: ${property.property_type}`,
      property.ownership_type && `Eierform: ${property.ownership_type}`,
      property.energy_label && `Energimerke: ${property.energy_label}`,
      property.plot_area && `Tomt: ${property.plot_area} m² (${property.plot_owned ? 'eiet' : 'festet'})`,
      property.facilities?.length && `Fasiliteter: ${property.facilities.join(', ')}`,
      property.summary && `\nSammendrag:\n${property.summary}`,
      property.property_info_text && `\nOm boligen:\n${property.property_info_text}`,
    ].filter(Boolean).join('\n')

    const agentName = agentProfile?.name || 'megler'

    const message = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Du er eiendomsmegler ${agentName}. Skriv et muntlig presentasjonsmanus på norsk for denne boligen. Tonen skal være: ${tone}.

Manuset skal:
- Vare ca. 45–60 sekunder når det leses opp (ca. 120–150 ord)
- Starte med å ønske seerne velkommen med en enkel, inviterende åpning, f.eks. "Jeg vil gjerne vise dere ...". Unngå overdrevent følelsesladde åpninger som "Jeg er svært glad for å vise dere ..." eller "Det er en stor glede å ..."
- Fremheve de mest attraktive egenskapene ved boligen
- Nevne pris og nøkkelinformasjon naturlig
- Avslutte med en invitasjon til visning eller kontakt
- Være naturlig og muntlig, ikke en punktliste
- VIKTIG: Priser og størrelser er allerede skrevet ut som tekst i dataene — bruk dem ORDRETT slik de er oppgitt, uten å endre til sifre. Eksempel: hvis dataene sier "to-hundre-og-åtti-fem kvadratmeter", skal du skrive nøyaktig "to-hundre-og-åtti-fem kvadratmeter" i manuset.
- VIKTIG: Ikke bruk forkortelser som BRA, kvm, m², osv. Si aldri "bruksareal".
- VIKTIG: Når du omtaler beliggenhet og gatenavnet slutter på "-veien", "-vegen", "-gata" eller "-gaten", bruk preposisjonen "i" — ikke "på". Skriv f.eks. "en leilighet i Storgata 15", aldri "en leilighet på Storgata 15".
- VIKTIG: Nevn aldri eksakte beløp for felleskostnader eller leieinntekter. Bruk heller kvalitative beskrivelser basert på beløpet: for felleskostnader si f.eks. "lave felleskostnader", "moderate felleskostnader" eller "rimelige felleskostnader". For leieinntekter si f.eks. "gode leieinntekter" eller "attraktive leieinntekter". Bruk kun disse beskrivelsene hvis feltene faktisk finnes i dataene.

Her er boligdataene:
${propertyDetails}

Svar KUN med manusteksten, ingen overskrift eller forklaring.`,
      }],
    })

    // Post-process: replace any "NNN kvadratmeter" with hyphenated Norwegian words
    const rawScript = (message.content[0] as { type: string; text: string }).text
    const script = rawScript.replace(/(\d+)\s+kvadratmeter/g, (_, n) =>
      sizeToNorwegian(Number(n)) + ' kvadratmeter'
    ).replace(/(\d[\d\s]*\d|\d)\s+kroner/g, (match, n) => {
      const num = Number(String(n).replace(/\s/g, ''))
      return isNaN(num) ? match : priceToNorwegian(num)
    })
    return NextResponse.json({ script })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
