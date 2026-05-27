import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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
      property.price && `Prisantydning: ${new Intl.NumberFormat('nb-NO').format(property.price)} kr`,
      property.price_total && `Totalpris inkl. omk.: ${new Intl.NumberFormat('nb-NO').format(property.price_total)} kr`,
      property.shared_debt && `Fellesgjeld: ${new Intl.NumberFormat('nb-NO').format(property.shared_debt)} kr`,
      property.shared_costs && `Felleskostnader: ${new Intl.NumberFormat('nb-NO').format(property.shared_costs)} kr/mnd`,
      property.size_bra && `BRA: ${property.size_bra} m²`,
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

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Du er eiendomsmegler ${agentName}. Skriv et muntlig presentasjonsmanus på norsk for denne boligen. Tonen skal være: ${tone}.

Manuset skal:
- Vare ca. 45–60 sekunder når det leses opp (ca. 120–150 ord)
- Starte med å ønske seerne velkommen
- Fremheve de mest attraktive egenskapene ved boligen
- Nevne pris og nøkkelinformasjon naturlig
- Avslutte med en invitasjon til visning eller kontakt
- Være naturlig og muntlig, ikke en punktliste

Her er boligdataene:
${propertyDetails}

Svar KUN med manusteksten, ingen overskrift eller forklaring.`,
      }],
    })

    const script = (message.content[0] as { type: string; text: string }).text
    return NextResponse.json({ script })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
