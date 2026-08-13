/** Offentlig origin for server-side redirects.
 *
 *  På Netlify kan `request.url` i routehandlere peke på deploy-permalinken
 *  eller netlify.app-subdomenet i stedet for domenet brukeren besøkte.
 *  En redirect bygget på `url.origin` flytter da brukeren til feil origin —
 *  der sesjonskakene fra reelhome.ai ikke finnes, så man lander
 *  tilsynelatende utlogget. (Samme feil brøt e-postbekreftelsen på
 *  YoPlanets 12. aug 2026.)
 *
 *  x-forwarded-host bærer verten brukeren faktisk besøkte. */
export function siteOrigin(request: Request): string {
  const host = (request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    new URL(request.url).host).split(',')[0].trim()
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
  return `${proto}://${host}`
}
