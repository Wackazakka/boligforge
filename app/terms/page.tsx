import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Vilkår for bruk — ReelHome',
  description: 'Vilkår og betingelser for bruk av ReelHome.',
}

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 96px', fontFamily: 'var(--font-geist-sans, sans-serif)', color: '#111', lineHeight: 1.7 }}>
      <Link href="/" style={{ fontSize: 14, color: '#666', textDecoration: 'none' }}>← ReelHome</Link>

      <h1 style={{ fontSize: 32, fontWeight: 700, marginTop: 32, marginBottom: 8 }}>Vilkår for bruk</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 40 }}>Sist oppdatert: 25. juni 2025</p>

      <Section title="1. Om tjenesten">
        <p>ReelHome er en SaaS-plattform levert av <strong>Norditech AS</strong> som gjør det mulig for eiendomsmeglere å produsere og publisere AI-genererte eiendomsvideoer. Ved å opprette en konto aksepterer du disse vilkårene.</p>
      </Section>

      <Section title="2. Kontoansvar">
        <p>Du er ansvarlig for å holde påloggingsinformasjonen din konfidensiell og for all aktivitet som skjer på din konto. Du må umiddelbart varsle oss på <a href="mailto:hei@reelhome.ai" style={{ color: '#111' }}>hei@reelhome.ai</a> ved mistanke om uautorisert bruk.</p>
      </Section>

      <Section title="3. Abonnement og betaling">
        <p>ReelHome tilbys som månedlig abonnement. Betaling håndteres av Stripe. Abonnementet fornyes automatisk til valgt plan inntil det sies opp. Oppsigelse trer i kraft ved slutten av inneværende betalingsperiode — du beholder tilgang frem til da.</p>
        <p>Vi forbeholder oss retten til å endre priser med 30 dagers varsel.</p>
      </Section>

      <Section title="4. Innhold og rettigheter">
        <p>Du beholder alle rettigheter til innholdet du laster opp (bilder, tekst, lydopptak). Ved å laste opp innhold gir du Norditech AS en begrenset, ikke-eksklusiv lisens til å bruke innholdet for å levere tjenesten — inkludert å generere videoer og publisere disse til sosiale medier på dine vegne.</p>
        <p>Du er ansvarlig for at du har rettigheter til innholdet du laster opp, og at det ikke krenker tredjeparts rettigheter.</p>
      </Section>

      <Section title="5. Facebook- og sosiale medier-integrasjoner">
        <p>Når du kobler til sosiale mediekontoer (Facebook, LinkedIn m.fl.), autoriserer du ReelHome til å publisere innhold på dine vegne til de kontoene du velger. Du kan trekke tilbake denne tilgangen når som helst fra innstillingene i ReelHome eller direkte i den aktuelle plattformen.</p>
      </Section>

      <Section title="6. Akseptabel bruk">
        <p>Du må ikke bruke ReelHome til å:</p>
        <ul>
          <li>Publisere innhold som er ulovlig, villedende eller krenkende.</li>
          <li>Laste opp innhold du ikke har rett til å bruke.</li>
          <li>Misbruke plattformen på en måte som skader andre brukere eller tjenestens infrastruktur.</li>
        </ul>
        <p>Vi forbeholder oss retten til å suspendere kontoer som bryter disse retningslinjene.</p>
      </Section>

      <Section title="7. Tilgjengelighet og endringer">
        <p>Vi tilstreber høy oppetid, men garanterer ikke uavbrutt tilgang til tjenesten. Vi kan endre eller avvikle funksjoner med rimelig varsel. Vesentlige endringer i disse vilkårene varsles via e-post.</p>
      </Section>

      <Section title="8. Ansvarsbegrensning">
        <p>ReelHome leveres «som det er». Norditech AS er ikke ansvarlig for indirekte tap, tapte inntekter eller konsekvenstap som følge av bruk av tjenesten. Vårt samlede ansvar overfor deg er begrenset til beløpet du har betalt de siste 3 månedene.</p>
      </Section>

      <Section title="9. Gjeldende lov">
        <p>Disse vilkårene er underlagt norsk rett. Eventuelle tvister løses ved Oslo tingrett.</p>
      </Section>

      <Section title="10. Kontakt">
        <p>Spørsmål om vilkårene kan rettes til:<br />
        <strong>Norditech AS</strong><br />
        <a href="mailto:hei@reelhome.ai" style={{ color: '#111' }}>hei@reelhome.ai</a>
        </p>
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, marginTop: 0 }}>{title}</h2>
      <div style={{ fontSize: 15, color: '#333' }}>{children}</div>
    </section>
  )
}
