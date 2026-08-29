import type { MetadataRoute } from 'next'

// ReelHome selges til meglere gjennom møter og kjedeavtaler — organisk søk er
// ikke en anskaffelseskanal (avklart med Lars 29.08.2026). Denne fila handler
// derfor ikke om synlighet, men om det motsatte: å holde interne flater,
// POC-er og testsider ute av søkeindeksen. Uten robots.txt var ALT crawlbart,
// og /admin, /avatar-poc, /avatar-test, /avatar-samtale og /preview svarer
// alle 200 offentlig.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/terms', '/privacy'],
      disallow: [
        '/api/',
        '/admin',
        '/dashboard',
        '/onboarding',
        '/auth',
        // Interne prototyper og testflater — ikke noe kunder skal finne i Google
        '/avatar-poc',
        '/avatar-test',
        '/avatar-samtale',
        '/preview',
        '/bolig-chat',
      ],
    },
    sitemap: 'https://reelhome.ai/sitemap.xml',
  }
}
