import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Personvernerklæring — ReelHome',
  description: 'Hvordan ReelHome samler inn, bruker og beskytter dine personopplysninger.',
}

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 96px', fontFamily: 'var(--font-geist-sans, sans-serif)', color: '#111', lineHeight: 1.7 }}>
      <Link href="/" style={{ fontSize: 14, color: '#666', textDecoration: 'none' }}>← ReelHome</Link>

      <h1 style={{ fontSize: 32, fontWeight: 700, marginTop: 32, marginBottom: 8 }}>Personvernerklæring</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 40 }}>Sist oppdatert: 25. juni 2025</p>

      <Section title="1. Behandlingsansvarlig">
        <p>ReelHome er en tjeneste levert av <strong>Norditech AS</strong> (heretter «vi», «oss» eller «ReelHome»).
        Norditech AS er behandlingsansvarlig for personopplysningene som behandles i forbindelse med bruk av tjenesten.</p>
        <p>Kontakt: <a href="mailto:hei@reelhome.ai" style={{ color: '#111' }}>hei@reelhome.ai</a></p>
      </Section>

      <Section title="2. Hvilke opplysninger samler vi inn?">
        <p>Vi samler inn følgende kategorier av personopplysninger:</p>
        <ul>
          <li><strong>Kontoopplysninger:</strong> navn, e-postadresse og passordhash ved registrering.</li>
          <li><strong>Profilopplysninger:</strong> profilbilde (avatarfoto), stemmeklone og kontaktinformasjon du oppgir som megler.</li>
          <li><strong>Eiendomsdata:</strong> adresser, bilder og tekst knyttet til eiendommer du laster opp.</li>
          <li><strong>Facebook-sidedata:</strong> tilgangstokener og side-ID for Facebook-sider du velger å koble til tjenesten, slik at vi kan publisere videoer på dine vegne.</li>
          <li><strong>Betalingsinformasjon:</strong> abonnements- og fakturastatus via Stripe. Vi lagrer ikke kortdetaljer.</li>
          <li><strong>Bruksdata:</strong> logger over videoproduksjon, publiseringer og innloggingshendelser.</li>
        </ul>
      </Section>

      <Section title="3. Hvordan bruker vi opplysningene?">
        <p>Vi bruker opplysningene til å:</p>
        <ul>
          <li>Levere og forbedre ReelHome-tjenesten.</li>
          <li>Produsere AI-genererte eiendomsvideoer basert på bildene og teksten du laster opp.</li>
          <li>Publisere videoer til Facebook-sider du har koblet til kontoen din, utelukkende på din forespørsel.</li>
          <li>Administrere abonnement og fakturering.</li>
          <li>Sende nødvendige service-e-poster (kontoverifisering, kvitteringer).</li>
        </ul>
        <p>Vi selger ikke personopplysninger til tredjeparter.</p>
      </Section>

      <Section title="4. Facebook- og Instagram-integrasjon">
        <p>Når du kobler til en Facebook-side, ber vi om følgende tillatelser:</p>
        <ul>
          <li><strong>pages_show_list</strong> — for å vise hvilke Facebook-sider du administrerer.</li>
          <li><strong>pages_manage_posts</strong> — for å publisere eiendomsvideoer til den siden du velger.</li>
          <li><strong>pages_read_engagement</strong> — for å hente statistikk om publiserte poster.</li>
          <li><strong>instagram_business_basic</strong> — for å identifisere Instagram Business-kontoen koblet til din Facebook-side.</li>
          <li><strong>instagram_content_publish</strong> — for å publisere eiendomsvideoer som Instagram Reels på dine vegne.</li>
        </ul>
        <p>Instagram Business-kontoer er koblet til Facebook-sider — du kobler til begge via én og samme innlogging. Vi lagrer kun aksesstoken knyttet til din Facebook-side og Instagram-konto for å utføre publiseringer du initierer. Vi deler ikke disse dataene med andre parter. Du kan til enhver tid trekke tilbake tilgangen fra Facebook under Innstillinger → Apper og nettsteder, eller fra ReelHome under Innstillinger → Sosiale kontoer.</p>
      </Section>

      <Section title="5. Tredjepartstjenester">
        <p>ReelHome benytter følgende underleverandører som kan behandle personopplysninger:</p>
        <ul>
          <li><strong>Supabase</strong> — database og autentisering (lagret i EU).</li>
          <li><strong>Stripe</strong> — betalingsbehandling.</li>
          <li><strong>Meta (Facebook/Instagram)</strong> — sosiale mediepubliseringer.</li>
          <li><strong>ElevenLabs</strong> — stemmekloning og tekst-til-tale.</li>
          <li><strong>D-ID</strong> — AI-avatarproduksjon.</li>
          <li><strong>Cloudflare R2</strong> — lagring av videoer og bilder.</li>
          <li><strong>Anthropic</strong> — AI-basert bildeklassifisering og tekstgenerering.</li>
        </ul>
      </Section>

      <Section title="6. Lagring og sletting">
        <p>Vi lagrer personopplysninger så lenge kontoen din er aktiv. Hvis du avslutter kontoen, sletter vi eller anonymiserer dine data innen 30 dager, med unntak av opplysninger vi er lovpålagt å bevare (f.eks. regnskapsmateriale i 5 år).</p>
      </Section>

      <Section title="7. Dine rettigheter (GDPR)">
        <p>Som registrert har du rett til å:</p>
        <ul>
          <li>Få innsyn i hvilke opplysninger vi har om deg.</li>
          <li>Kreve retting av uriktige opplysninger.</li>
          <li>Kreve sletting («retten til å bli glemt»).</li>
          <li>Kreve begrensning av behandling.</li>
          <li>Dataportabilitet.</li>
          <li>Klage til Datatilsynet (datatilsynet.no).</li>
        </ul>
        <p>Send forespørsler til <a href="mailto:hei@reelhome.ai" style={{ color: '#111' }}>hei@reelhome.ai</a>.</p>
      </Section>

      <Section title="8. Informasjonskapsler (cookies)">
        <p>ReelHome bruker nødvendige informasjonskapsler for innloggingssesjoner. Vi bruker ingen sporings- eller markedsføringscookies.</p>
      </Section>

      <Section title="9. Endringer">
        <p>Vi kan oppdatere denne erklæringen. Vesentlige endringer varsles på e-post eller ved innlogging. Dato for siste oppdatering vises øverst på siden.</p>
      </Section>

      <Section title="10. Kontakt">
        <p>Spørsmål om personvern kan rettes til:<br />
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
