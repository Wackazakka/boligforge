// Kuratert kostnadsbase for ReelHome Avatar (nivå 2 — godkjent av Lars 2026-06-11).
//
// VEILEDENDE norske prisspenn for vanlige utbedringer knyttet til TG2/TG3-avvik.
// Spennene er bevisst VIDE og konservative. Reglene i prompten krever at hvert
// kostnadssvar basert på denne tabellen leveres med forbehold, og at rapportens
// egne kostnadsanslag alltid har forrang.
//
// Vedlikehold: juster spennene her ved behov — endringer reviewes via git.
// (Kan flyttes til DB m/ admin-UI senere hvis meglere skal kunne justere selv.)

export const COST_BASE: { tema: string; spenn: string; merknad?: string }[] = [
  { tema: 'Drenering rundt grunnmur', spenn: '100 000 – 400 000 kr', merknad: 'avhenger av grunnforhold, tilgjengelighet og lengde' },
  { tema: 'Totalrenovering av bad', spenn: '250 000 – 500 000 kr', merknad: 'standard størrelse, våtromsnorm' },
  { tema: 'Omlegging av tak (taktekking)', spenn: '150 000 – 450 000 kr', merknad: 'avhenger av takflate, type tekking og stillasbehov' },
  { tema: 'Utskifting av vindu', spenn: '8 000 – 25 000 kr per vindu', merknad: 'montert, standard størrelse' },
  { tema: 'Bytte av punktert glass (isolerglass)', spenn: '3 000 – 8 000 kr per glass' },
  { tema: 'Utskifting av ytterdør', spenn: '15 000 – 40 000 kr', merknad: 'montert' },
  { tema: 'Radontiltak (sperre/brønn/ventilasjon)', spenn: '20 000 – 80 000 kr', merknad: 'måling først, ca 1 000–2 000 kr' },
  { tema: 'Nytt sikringsskap', spenn: '15 000 – 50 000 kr' },
  { tema: 'Full rehabilitering av elektrisk anlegg', spenn: '80 000 – 200 000 kr', merknad: 'avhenger av boligens størrelse' },
  { tema: 'Rehabilitering av pipe/skorstein', spenn: '20 000 – 80 000 kr' },
  { tema: 'Utskifting av vann- og avløpsrør (rør-i-rør)', spenn: '100 000 – 300 000 kr' },
  { tema: 'Ny varmtvannsbereder', spenn: '15 000 – 35 000 kr', merknad: 'montert' },
  { tema: 'Etterisolering av loft', spenn: '30 000 – 100 000 kr' },
  { tema: 'Delvis utskifting/maling av utvendig kledning', spenn: '50 000 – 250 000 kr' },
  { tema: 'Rehabilitering av terrasse/balkong', spenn: '50 000 – 200 000 kr' },
  { tema: 'Utbedring av fuktskade i kjeller', spenn: '50 000 – 500 000 kr', merknad: 'svært avhengig av årsak og omfang — krever befaring' },
  { tema: 'Nytt kjøkken', spenn: '100 000 – 400 000 kr', merknad: 'avhenger av standard og størrelse' },
  { tema: 'Oppretting/utbedring av lokale setningsskader', spenn: '100 000 – 600 000 kr', merknad: 'krever alltid fagvurdering først' },
]

// Aktiveres kun når spørsmålet handler om kostnad/pris for utbedring
export function isCostQuestion(question: string): boolean {
  return /\b(kost|pris|hva vil det|hvor mye|utbedre|fikse|reparere|budsjett|dyrt|billig)\w*/i.test(question)
}

export function buildCostBaseSection(): string {
  const rows = COST_BASE.map(c => `- ${c.tema}: ${c.spenn}${c.merknad ? ` (${c.merknad})` : ''}`).join('\n')
  return `
VEILEDENDE KOSTNADSBASE (generelle norske prisspenn for vanlige utbedringer — IKKE vurdert for denne konkrete boligen):
${rows}

KOSTNADSREGLER (gjelder alltid når du oppgir kostnader):
A. Hvis tilstandsrapporten selv oppgir et kostnadsanslag for avviket: bruk DET, og si at det er takstmannens anslag.
B. Hvis rapporten ikke har anslag, kan du bruke kostnadsbasen over — men da MÅ du si tydelig at dette er et generelt veiledende prisspenn som ikke er vurdert for denne boligen, og anbefale å innhente tilbud fra fagfolk før beslutning.
C. Aldri oppgi ett eksakt tall — alltid spennet.
D. Finnes ikke utbedringen i kostnadsbasen og rapporten mangler anslag: si ærlig at du ikke kan anslå den posten, og hold den utenfor summen (men nevn at den kommer i tillegg).
E. Ved spørsmål om TOTALKOSTNAD (f.eks. «hva koster det å sette huset i stand», «alle TG2 og TG3 samlet»): VÆR KONKRET. Gå gjennom hvert avvik muntlig med sitt spenn (rapportens anslag først, ellers kostnadsbasen), og avslutt med et samlet veiledende spenn — summen av lav-endene til summen av høy-endene. Si tydelig at totalen er et grovt veiledende overslag som forutsetter fagtilbud, men IKKE nekt å regne: et ærlig spenn med forbehold er mer nyttig for kjøperen enn «flere hundretusen». Husk å gange opp like poster (f.eks. fire våtrom = fire ganger spennet for bad).`
}
