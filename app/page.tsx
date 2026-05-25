import Link from "next/link";
import VideoHero from "./VideoHero";
import MusicTracks from "./MusicTracks";

const R2 = 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/template-avatars'
const PRESETS_BASE = 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/presets'
const AVATARS = [
  { id: 'sofia',  name: 'Sofia',  desc: 'Varm og profesjonell', lang: 'NO·BM' },
  { id: 'marius', name: 'Marius', desc: 'Klar og selvsikker',   lang: 'NO·BM' },
  { id: 'ingrid', name: 'Ingrid', desc: 'Nordisk og elegant',   lang: 'NO·NN' },
  { id: 'even',   name: 'Even',   desc: 'Rolig og trygg',       lang: 'NO·BM' },
  { id: 'hanna',  name: 'Hanna',  desc: 'Engasjert og moderne', lang: 'NO·BM' },
  { id: 'erik',   name: 'Erik',   desc: 'Erfaren og grundig',   lang: 'NO·NN' },
]

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const HomeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10z" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function Home() {
  return (
    <div className="landing">

      {/* ─────────────────────────────────── NAV */}
      <nav className="top">
        <div className="wrap">
          <a href="#" className="rh-lockup" aria-label="ReelHome">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand-kit/reelhome-mark-moss.svg" alt="" width="68" height="68" />
            <span className="rh-wm" style={{ fontSize: '45px' }}>ReelHome<span className="rh-ai">.ai</span></span>
          </a>
          <div className="nav-links">
            <a href="#hvordan">Hvordan</a>
            <a href="#funksjoner">Funksjoner</a>
            <a href="#priser">Priser</a>
            <a href="#tilgang">Tidlig tilgang</a>
          </div>
          <div className="nav-cta">
            <Link href="/auth/login" className="btn btn-text">Logg inn</Link>
            <Link href="/auth/signup" className="btn btn-primary">Kom i gang <span className="kbd">↵</span></Link>
          </div>
        </div>
      </nav>

      {/* ─────────────────────────────────── HERO */}
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-head">
            <h1>Profesjonelle visningsvideoer<br /><span className="blue">På ti minutter.</span></h1>
            <p className="hero-sub">
              ReelHome genererer ferdige visningsvideoer automatisk — med AI-vert, klonet stemme og kuratert musikk.
              Lim inn Finn-lenken, motta ferdig film klar for Facebook og LinkedIn.
            </p>
            <div className="hero-cta">
              <Link href="/auth/signup" className="btn btn-primary">
                Start gratis prøveperiode <ArrowIcon />
              </Link>
              <a href="#hvordan" className="btn btn-ghost">
                Se hvordan <span className="kbd">D</span>
              </a>
              <span className="meta">14 dager gratis · Ingen kortinfo</span>
            </div>
          </div>

          {/* ── Editor mockup */}
          <div className="product-frame">
            <VideoHero />
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────── HOW IT WORKS */}
      <section id="hvordan">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow"><span className="dot" />Slik fungerer det</span>
            <h2>Fra prospekt til ferdig film.<br /><span style={{ color: "var(--muted)" }}>Tre steg, ti minutter.</span></h2>
          </div>

          <div className="steps">
            <div className="step">
              <div className="head"><span className="num">01</span><span className="time">~1 min</span></div>
              <div className="vis">
                <div className="v1-url">
                  <div className="v1-url-bar">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.4,flexShrink:0}}>
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    <span className="v1-url-text">finn.no/realestate/homes/ad.html?finnkode=123456</span>
                    <button className="v1-url-btn">Hent</button>
                  </div>
                  <div className="v1-parsed">
                    <div className="v1-row"><span className="v1-check">✓</span><span className="v1-key">Adresse</span><span className="v1-val">Bygdøy allé 24, Oslo</span></div>
                    <div className="v1-row"><span className="v1-check">✓</span><span className="v1-key">Pris</span><span className="v1-val">7 200 000 kr</span></div>
                    <div className="v1-row"><span className="v1-check">✓</span><span className="v1-key">BRA</span><span className="v1-val">112 m²</span></div>
                    <div className="v1-row"><span className="v1-check">✓</span><span className="v1-key">Bilder</span><span className="v1-val">18 hentet</span></div>
                  </div>
                </div>
              </div>
              <h3>Lim inn Finn-lenken</h3>
              <p>Vi henter bilder, pris, adresse og nøkkeldata automatisk. Ingen opplasting — bare en URL.</p>
            </div>

            <div className="step">
              <div className="head"><span className="num">02</span><span className="time">~1 min</span></div>
              <div className="vis">
                <div className="v2-wrap">
                  <div className="v2-grid">
                    {AVATARS.map((av, i) => (
                      <div key={av.id} className={`v2-tile${i === 1 ? ' on' : ''}`}>
                        <img src={`${R2}/${av.id}.jpg`} alt={av.name} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center 15%',display:'block'}} />
                      </div>
                    ))}
                  </div>
                  <div className="v2-music">
                    <span className="v2-play">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </span>
                    <div className="v2-music-info">
                      <span className="v2-music-name">Nordlys</span>
                      <span className="v2-music-meta">Ambient · Strykere · 80 BPM</span>
                    </div>
                    <span className="v2-music-dur">02:42</span>
                  </div>
                </div>
              </div>
              <h3>Velg vert, stemme og musikk</h3>
              <p>Seks AI-avatarer eller din egen digitale tvilling. Velg musikk kuratert for norske boliger.</p>
            </div>

            <div className="step">
              <div className="head"><span className="num">03</span><span className="time">~8 min</span></div>
              <div className="vis v3-vis">
                <div className="v3-thumb">
                  <span className="v3-play-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </span>
                  <span className="v3-ratio-tag">16:9</span>
                </div>
                <div className="v3-footer">
                  <div className="v3-file-info">
                    <span className="v3-file-name">bygdoy-alle-24.mp4</span>
                    <span className="v3-file-meta">1080p · 248 MB</span>
                  </div>
                  <a className="v3-dl">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </a>
                </div>
              </div>
              <h3>Render og last ned</h3>
              <p>Ferdig film i 16:9 med kontorets logo og farger. Klar til Finn og sosiale medier.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────── FEATURES */}
      <section id="funksjoner" style={{ paddingTop: 0, paddingBottom: '16px' }}>
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow"><span className="dot" />Funksjoner</span>
            <h2>Din digitale kopi. I alle filmer.</h2>
            <p>Sett opp én gang. Bruk for alltid. Klonen din leverer alle boliger med ditt ansikt og din stemme — automatisk.</p>
          </div>

          <div className="features">

            {/* Digital Clone — full width hero, dark */}
            <div className="feat feat-1 dark" style={{ gridColumn: 'span 6' }}>
              <div className="clone-layout">
                <div className="clone-text">
                  <span className="eyebrow"><span className="dot" />Digital klon · Kun hos ReelHome</span>
                  <h3>En versjon av deg<br />som aldri<br />er opptatt.</h3>
                  <p className="desc">Tenk deg at du kan presentere alle dine boliger — samtidig, når som helst, på alle plattformer — uten å stå foran kamera én eneste gang til. Det er ikke en tankelek. Det er det ReelHome gjør for deg. Last opp ett bilde og les en tekst. Resten tar din digitale tvilling seg av.</p>
                  <div className="clone-setup">
                    <div className="cs-step">
                      <span className="cs-n">01</span>
                      <span>Last opp ett bilde</span>
                    </div>
                    <span className="cs-sep">+</span>
                    <div className="cs-step">
                      <span className="cs-n">02</span>
                      <span>Les teksten (~2 min)</span>
                    </div>
                    <span className="cs-sep">→</span>
                    <div className="cs-step cs-done">
                      <span className="cs-n">✓</span>
                      <span>Din kopi er klar</span>
                    </div>
                  </div>
                </div>
                <div className="clone-vis">
                  <div className="clone-portrait">
                    { /* eslint-disable-next-line @next/next/no-img-element */ }
                    <img src={`${R2}/sofia.jpg`} alt="Avatar" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center 10%'}} />
                    <div className="clone-voice-bar">
                      <span className="clone-voice-label">Stemme</span>
                      <div className="waveform" style={{height:'22px'}}>
                        {Array.from({length: 32}, (_, i) => (
                          <span key={i} style={{
                            animationDelay: `-${(i * 0.05).toFixed(2)}s`,
                            animationDuration: `${(1 + (i % 5) * 0.15).toFixed(2)}s`,
                            opacity: 0.7 + (i % 4) / 12,
                          }} />
                        ))}
                      </div>
                    </div>
                    <div className="clone-tag">Din digitale kopi</div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',flex:1}}>
                    {[
                      {label:'Foran bolig',    src:`${PRESETS_BASE}/sofia_modern_home.png`},
                      {label:'Kontormiljø',    src:`${PRESETS_BASE}/sofia_office.png`},
                      {label:'Nøytral studio', src:`${PRESETS_BASE}/sofia_studio.png`},
                      {label:'Utendørs',       src:`${PRESETS_BASE}/sofia_neighborhood.png`},
                    ].map(({label, src}) => (
                      <div key={label} style={{position:'relative',borderRadius:'8px',overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)',minHeight:'80px'}}>
                        { /* eslint-disable-next-line @next/next/no-img-element */ }
                        <img src={src} alt={label} style={{width:'100%',height:'100%',objectFit:'cover',display:'block',position:'absolute',inset:0}} />
                        <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.45) 0%,transparent 55%)'}} />
                        <span style={{position:'absolute',bottom:'8px',left:'10px',fontSize:'10px',fontWeight:500,color:'rgba(255,255,255,0.85)'}}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────── MID-PAGE CTA */}
      <section className="cta-final" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="wrap-tight">
          <span className="eyebrow"><span className="dot" />Klar når du er det</span>
          <h2 style={{ marginTop: "24px" }}>
            Lag din første video.<br /><span className="blue">Gratis i 14 dager.</span>
          </h2>
          <p>Ingen kortinformasjon. Ingen forpliktelser. Last opp én bolig, se hva ReelHome gjør med den.</p>
          <div className="hero-cta" style={{ justifyContent: "center" }}>
            <Link href="/auth/signup" className="btn btn-primary">Start gratis prøveperiode <ArrowIcon /></Link>
            <a href="#" className="btn btn-ghost">Book demo</a>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────── FEATURES ROW 2 */}
      <section style={{ paddingTop: '88px', paddingBottom: '16px' }}>
        <div className="wrap">
          <div className="features">
            {/* Speed — spans 3 cols */}
            <div className="feat feat-2">
              <div>
                <span className="eyebrow"><span className="dot" />Hastighet</span>
                <h3>Tre dager → ti minutter.</h3>
                <p className="desc">Sammenlignet med tradisjonelt byrå-arbeid.</p>
              </div>
              <div className="feat-vis">
                <div className="speed">
                  <div className="row">
                    <span className="k">Hos byrå</span>
                    <div className="bar"><span className="old" /></div>
                    <span className="v old-v">3 dager</span>
                  </div>
                  <div className="row">
                    <span className="k">Egenproduksjon</span>
                    <div className="bar"><span className="old" style={{ width: "35%" }} /></div>
                    <span className="v old-v">5 timer</span>
                  </div>
                  <div className="row">
                    <span className="k" style={{ color: "var(--blue)" }}>ReelHome</span>
                    <div className="bar"><span className="new" style={{ width: "4%" }} /></div>
                    <span className="v" style={{ color: "var(--blue)" }}>10 min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Music — spans 3 cols */}
            <div className="feat feat-3">
              <div>
                <span className="eyebrow"><span className="dot" />Musikkbibliotek</span>
                <h3>Spesialkomponert musikk.</h3>
                <p className="desc">Originale spor produsert eksklusivt for ReelHome. Tempo og klipping synkroniseres automatisk.</p>
              </div>
              <div className="feat-vis">
                <MusicTracks />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────── PRICING */}
      <section id="priser" style={{ paddingTop: '64px' }}>
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow"><span className="dot" />Priser</span>
            <h2>Enkel prising. Ingen overraskelser.</h2>
            <p>Faktureres månedlig i NOK eks. mva. Ubrukte videoer rulles over én måned. Ingen bindingstid.</p>
          </div>

          <div className="price-grid">
            {/* Starter */}
            <div className="plan">
              <div className="nm">Starter</div>
              <div className="for">For meglere som tester</div>
              <div className="price"><span className="v">1 047</span><span className="cur">kr / mnd</span></div>
              <div className="desc">3 ferdig produserte videoer hver måned, full tilgang til avatarbiblioteket.</div>
              <ul>
                <li><CheckIcon /> <span><b>3 videoer</b> per måned</span></li>
                <li><CheckIcon /> Tilgang til 12 AI-avatarer</li>
                <li><CheckIcon /> 1080p · 9:16, 16:9, 1:1</li>
                <li><CheckIcon /> Royalty-fritt musikkbibliotek</li>
                <li><CheckIcon /> Standard rendring (~5 min)</li>
              </ul>
              <Link href="/auth/signup" className="btn btn-ghost">Start gratis prøveperiode</Link>
            </div>

            {/* Pro */}
            <div className="plan featured">
              <span className="badge">Mest populær</span>
              <div className="nm">Pro</div>
              <div className="for">For aktive meglere</div>
              <div className="price"><span className="v">1 990</span><span className="cur">kr / mnd</span></div>
              <div className="desc">10 videoer i måneden, din egen stemmeklone og kontorprofil i hver film.</div>
              <ul>
                <li><CheckIcon /> <span><b>10 videoer</b> per måned</span></li>
                <li><CheckIcon /> <b>Personlig stemmeklone</b> inkludert</li>
                <li><CheckIcon /> 4K-rendring · prioritert kø</li>
                <li><CheckIcon /> Egen meglerprofil og logo</li>
                <li><CheckIcon /> Direkte publisering: Finn, IG, TikTok</li>
                <li><CheckIcon /> Analyse av seeradferd</li>
              </ul>
              <Link href="/auth/signup" className="btn btn-blue">Velg Pro <ArrowIcon /></Link>
            </div>

            {/* Kontor */}
            <div className="plan">
              <div className="nm">Kontor</div>
              <div className="for">For hele meglerhuset</div>
              <div className="price"><span className="v">999</span><span className="cur">kr / megler · mnd</span></div>
              <div className="desc">7 videoer per megler hver måned, sentralisert merkevareprofil og dedikert oppfølging.</div>
              <ul>
                <li><CheckIcon /> <span><b>7 videoer</b> per megler · mnd</span></li>
                <li><CheckIcon /> Stemmeklone for hver megler</li>
                <li><CheckIcon /> <b>Skreddersydd</b> avatar mulig</li>
                <li><CheckIcon /> Sentralisert merkevareprofil</li>
                <li><CheckIcon /> SSO · admin · fakturasamling</li>
                <li><CheckIcon /> Dedikert kundeansvarlig</li>
              </ul>
              <a href="#" className="btn btn-ghost">Snakk med salg</a>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────── EARLY ACCESS */}
      <section id="tilgang" className="early-access">
        <div className="wrap">
          <div className="ea-card">
            <span className="eyebrow"><span className="dot" />Tidlig lansering</span>
            <h2>Vær med fra start.</h2>
            <p className="ea-sub">
              ReelHome åpner for de første meglerkontorene nå. Grunnlegger-brukere låser
              fast dagens pris og former produktet direkte.
            </p>
            <div className="ea-perks">
              <div className="ea-perk">
                <div className="ea-num">01</div>
                <h4>Grunnlegger-pris</h4>
                <p>Prisen du starter med er garantert i 2 år — uansett hva listen koster da.</p>
              </div>
              <div className="ea-perk">
                <div className="ea-num">02</div>
                <h4>Direkte linje til teamet</h4>
                <p>Innspillene dine bygger neste versjon. Vi har dedikert tid til tidlige brukere hver uke.</p>
              </div>
              <div className="ea-perk">
                <div className="ea-num">03</div>
                <h4>Alltid først ut</h4>
                <p>Tidlig tilgang til alle nye funksjoner — avatarer, integrasjoner og analyseverktøy.</p>
              </div>
            </div>
            <div className="hero-cta" style={{ justifyContent: "center" }}>
              <Link href="/auth/signup" className="btn btn-primary">Sikre din plass <ArrowIcon /></Link>
              <a href="mailto:hei@reelhome.no" className="btn btn-ghost">Snakk med oss</a>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────── FAQ */}
      <section id="faq">
        <div className="wrap">
          <div className="faq-grid">
            <div>
              <span className="eyebrow"><span className="dot" />Vanlige spørsmål</span>
              <h2>Det du lurer på.</h2>
              <p className="side-note">
                Finner du ikke svaret? Skriv til{" "}
                <a href="mailto:hei@reelhome.no" suppressHydrationWarning>hei@reelhome.no</a>
                {" "}— vi svarer innen samme arbeidsdag.
              </p>
            </div>

            <div>
              <details className="faq-item" open>
                <summary>Hvor lang tid tar det å lage én video? <span className="icon" /></summary>
                <p>Fra du har lastet opp prospekt og bilder til ferdig film tar det normalt 4–6 minutter på Starter, og 2–3 minutter på Pro med prioritert rendring.</p>
              </details>
              <details className="faq-item">
                <summary>Kan jeg bruke min egen stemme i stedet for en avatar? <span className="icon" /></summary>
                <p>Ja. På Pro og Kontor får du en personlig stemmeklone som leverer alle manus med ditt eget tonefall. Du trenger kun å spille inn tre minutter med tekst første gang.</p>
              </details>
              <details className="faq-item">
                <summary>Følger videoene merkevareprofilen vår? <span className="icon" /></summary>
                <p>Vi henter inn logoer, farger og typografi fra kontoret ditt. Hver film leveres i din visuelle identitet — fra åpningsbilde til avslutningsskjerm.</p>
              </details>
              <details className="faq-item">
                <summary>Hvilke språk støttes? <span className="icon" /></summary>
                <p>Bokmål og nynorsk er begge støttet på alle avatarer. Engelsk, svensk og dansk er tilgjengelig på Pro og Kontor for internasjonale prospekter.</p>
              </details>
              <details className="faq-item">
                <summary>Hva med GDPR og bilderettigheter? <span className="icon" /></summary>
                <p>Alle bilder og prospekt lagres i EU (Frankfurt). Stemmekloner er kryptert og kun tilgjengelige for deg. Musikkbiblioteket er royalty-fritt og lisensiert for kommersiell bruk i Norge.</p>
              </details>
              <details className="faq-item">
                <summary>Kan jeg avslutte abonnementet når jeg vil? <span className="icon" /></summary>
                <p>Ja. Ingen bindingstid. Du beholder tilgang ut betalt periode, og kan laste ned alle filmer du har produsert.</p>
              </details>
              <details className="faq-item">
                <summary>Integreres ReelHome med Vitec Next / Tribe? <span className="icon" /></summary>
                <p>API-integrasjon mot Vitec Next, Tribe og WebMegler er tilgjengelig på Kontor-planen. Boligen synces inn automatisk når oppdraget opprettes.</p>
              </details>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────── FINAL CTA */}
      {/* ─────────────────────────────────── FOOTER */}
      <footer className="landing-footer">
        <div className="wrap">
          <div className="foot-top">
            <div className="foot-brand">
              <a href="/" className="rh-lockup" aria-label="ReelHome">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand-kit/reelhome-mark.svg" alt="" width="24" height="24" />
                <span className="rh-wm" style={{ fontSize: '18px' }}>ReelHome<span className="rh-ai">.ai</span></span>
              </a>
              <p>AI-drevet videoproduksjon for norske eiendomsmeglere.</p>
              <div className="foot-status"><span className="dot" />Alle systemer operative</div>
            </div>
            <div>
              <h4>Produkt</h4>
              <ul>
                <li><a href="#funksjoner">Funksjoner</a></li>
                <li><a href="#priser">Priser</a></li>
                <li><a href="#tilgang">Tidlig tilgang</a></li>
              </ul>
            </div>
            <div>
              <h4>Kontakt</h4>
              <ul>
                <li><a href="mailto:hei@reelhome.no">hei@reelhome.no</a></li>
              </ul>
            </div>
          </div>
          <div className="foot-bot">
            <span>© 2026 ReelHome AS</span>
            <span>Powered by <a href="https://norditech.no" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500 }}>Norditech AS</a></span>
          </div>
        </div>
      </footer>

    </div>
  );
}
