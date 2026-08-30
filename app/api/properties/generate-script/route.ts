import { NextResponse } from 'next/server'
import { createMessage } from '../../../../lib/anthropic'
import { priceToNorwegian, sizeToNorwegian, yearToNorwegian, below1000 } from '../../../../lib/norwegian-numbers'
import { MODELS } from '../../../../lib/models'

export async function POST(request: Request) {
  try {
    const { property, agentProfile, scriptStyle, noPresenter } = await request.json()

    // To akser som KOMBINERES: meglerens tone (profilvalg — hvem du er) og
    // videoens stil (per bolig — hvem kjøperen er). Tidligere overstyrte
    // stilene tonen helt, så profilvalget bare gjaldt «Nøytral».
    const agentTone = agentProfile?.tone_of_voice || 'profesjonell og engasjert'
    const styleDescriptions: Record<string, string> = {
      luxury:  'eksklusiv og prestisjefylt vinkling. Vektlegg unike detaljer, premium materialer og eksklusiv beliggenhet',
      family:  'familievinkling. Vektlegg plass, nærhet til skoler/barnehager, trygt nabolag og familievennlige løsninger',
      young:   'vinkling mot førstegangskjøpere. Vektlegg tilgjengelighet, smart planløsning og gode transportmuligheter',
    }
    const styleOverlay = styleDescriptions[scriptStyle ?? 'neutral']
    const tone = styleOverlay
      ? `${agentTone}. Målgruppetilpasning: ${styleOverlay}`
      : agentTone

    const propertyDetails = [
      property.title && `Tittel: ${property.title}`,
      property.address && `Adresse: ${property.address}`,
      property.price && `Prisantydning: ${priceToNorwegian(Number(property.price))}`,
      property.price_total && `Totalpris inkl. omk.: ${priceToNorwegian(Number(property.price_total))}`,
      property.shared_debt && `Fellesgjeld: ${priceToNorwegian(Number(property.shared_debt))}`,
      property.shared_costs && `Felleskostnader: ja (beskriv som lave/moderate/rimelige basert på skjønn)`,
      property.size_bra && `Størrelse: ${sizeToNorwegian(Number(property.size_bra))} kvadratmeter`,
      property.rooms && `Rom: ${below1000(Number(property.rooms))}`,
      property.bedrooms && `Soverom: ${below1000(Number(property.bedrooms))}`,
      property.floor && `Etasje: ${property.floor}`,
      property.build_year && `Byggeår: ${yearToNorwegian(Number(property.build_year))}`,
      property.property_type && `Boligtype: ${property.property_type}`,
      property.ownership_type && `Eierform: ${property.ownership_type}`,
      property.energy_label && `Energimerke: ${property.energy_label}`,
      property.plot_area && `Tomt: ${sizeToNorwegian(Number(property.plot_area))} kvadratmeter (${property.plot_owned ? 'eiet' : 'festet'})`,
      property.facilities?.length && `Fasiliteter: ${property.facilities.join(', ')}`,
      property.summary && `\nSammendrag:\n${property.summary}`,
      property.property_info_text && `\nOm boligen:\n${property.property_info_text}`,
    ].filter(Boolean).join('\n')

    const agentName = agentProfile?.name || 'megler'

    // Uten avatar-sporet (30/8): fortellerstemme — ingen megler presenteres,
    // og manuset skal aldri si «jeg»/«meg» om en person som ikke vises.
    const rolle = noPresenter
      ? `Skriv et muntlig presentasjonsmanus på norsk for denne boligen — en fortellerstemme uten synlig presentør.`
      : `Du er eiendomsmegler ${agentName}. Skriv et muntlig presentasjonsmanus på norsk for denne boligen.`
    const aapning = noPresenter
      ? `- Starte rett på boligen med en kort, inviterende åpning — presenter ALDRI noen megler ved navn, og bruk aldri "jeg", "meg" eller "vi" om en megler. F.eks. "Velkommen til ...". Avslutningen inviterer til visning eller kontakt uten å love at noen bestemt person tar imot.`
      : `- Starte med en kort, vennlig hilsen og presentere deg med navn, og deretter en enkel, inviterende åpning. F.eks. "Hei! Jeg heter ${agentName}, og jeg vil gjerne vise dere ...". Unngå overdrevent følelsesladde åpninger som "Jeg er svært glad for å vise dere ..." eller "Det er en stor glede å ..."`

    const message = await createMessage({
      model: MODELS.haiku,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `${rolle} Tonen skal være: ${tone}.

Manuset skal:
- Vare ca. 45–60 sekunder når det leses opp (ca. 120–150 ord)
${aapning}
- Fremheve de mest attraktive egenskapene ved boligen
- Nevne pris og nøkkelinformasjon naturlig
- Avslutte med en invitasjon til visning eller kontakt
- Være naturlig og muntlig, ikke en punktliste
- VIKTIG: Alle tall (priser, størrelser, byggeår, rom) er allerede skrevet ut som tekst i dataene — bruk dem ORDRETT slik de er oppgitt, uten å endre til sifre. Eksempel: hvis dataene sier "to-hundre-og-åtti-fem kvadratmeter", skal du skrive nøyaktig "to-hundre-og-åtti-fem kvadratmeter" i manuset.
- VIKTIG: Ikke bruk forkortelser som BRA, kvm, m², osv. Si aldri "bruksareal".
- VIKTIG: Boligtypen skal alltid samsvare nøyaktig med "Boligtype"-feltet i dataene. Aldri gjett eller endre boligtype — kall f.eks. aldri en leilighet for enebolig eller omvendt. Hvis "Boligtype" ikke er oppgitt, unngå å nevne en spesifikk boligtype og omtal det heller som "boligen" eller "hjemmet".
- VIKTIG: Når du omtaler beliggenhet og gatenavnet slutter på "-veien", "-vegen", "-gata" eller "-gaten", bruk preposisjonen "i" — ikke "på". Skriv f.eks. "en leilighet i Storgata 15", aldri "en leilighet på Storgata 15".
- VIKTIG: Etasjer omtales med preposisjonen "i", aldri "på". Skriv "i sjuende etasje", aldri "på sjuende etasje".
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
    // «i N-te etasje», aldri «på» — vanlig modellfeil prompten alene ikke stopper.
    // Fanger «på sjuende etasje», «på 7. etasje», «helt oppe på øverste etasje».
    }).replace(/\b(på|På)(\s+(?:[0-9a-zA-ZæøåÆØÅ.]+\s+)?etasje)/g,
      (_m, p, rest) => (p === 'På' ? 'I' : 'i') + rest)
    return NextResponse.json({ script })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
