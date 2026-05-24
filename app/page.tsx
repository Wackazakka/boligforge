import Link from "next/link";

const R2 = 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/template-avatars'
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
          <a href="#" className="logo">
            { /* eslint-disable-next-line @next/next/no-img-element */ }
            <img src="/logo.png?v=1" alt="ReelHome" style={{ height: '72px', width: 'auto' }} />
            <span className="ver mono">v2.0</span>
          </a>
          <div className="nav-links">
            <a href="#hvordan">Hvordan</a>
            <a href="#funksjoner">Funksjoner</a>
            <a href="#priser">Priser</a>
            <a href="#kunder">Kunder</a>
            <a href="#">Dokumentasjon</a>
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
            <span className="eyebrow"><span className="dot" />Tilgjengelig nå · For norske meglerhus</span>
            <h1>Profesjonelle visningsvideoer.<br /><span className="blue">På fem minutter.</span></h1>
            <p className="hero-sub">
              ReelHome genererer ferdige listingsvideoer automatisk — med AI-vert, klonet stemme og kuratert musikk.
              Last opp boligen, motta filmen klar til Finn, Reels og TikTok.
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
            <div className="pf-chrome">
              <div className="dots"><span /><span /><span /></div>
              <div className="url">
                <div className="url-inner">
                  <span>app.reelhome.no</span>/p/<span className="b">bygdoy-alle-24</span>/editor
                </div>
              </div>
            </div>

            <div className="editor">

              {/* left sidebar */}
              <div className="ed-side">
                <div className="section">Prosjekter</div>
                <div className="ed-item active">
                  <span className="ico"><HomeIcon /></span>
                  <span>Bygdøy allé 24</span>
                  <span className="badge">2:04</span>
                </div>
                <div className="ed-item">
                  <span className="ico"><HomeIcon /></span>
                  <span>Stabekkveien 12</span>
                  <span className="badge">draft</span>
                </div>
                <div className="ed-item">
                  <span className="ico"><HomeIcon /></span>
                  <span>Markveien 51 B</span>
                </div>
                <div className="ed-item">
                  <span className="ico"><HomeIcon /></span>
                  <span>Sandøsund 8</span>
                </div>

                <div className="divider" />

                <div className="section">Bibliotek</div>
                <div className="ed-item">
                  <span className="ico">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                    </svg>
                  </span>
                  <span>Avatarer</span>
                  <span className="badge">12</span>
                </div>
                <div className="ed-item">
                  <span className="ico">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                  </span>
                  <span>Musikk</span>
                  <span className="badge">400+</span>
                </div>
                <div className="ed-item">
                  <span className="ico">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M3 5h18M3 12h18M3 19h18" />
                    </svg>
                  </span>
                  <span>Maler</span>
                </div>

                <div className="upgrade">
                  <div className="t">Pro-plan</div>
                  <div className="d">Lås opp stemmekloning og 4K-rendring.</div>
                  <button>Oppgrader →</button>
                </div>
              </div>

              {/* main canvas */}
              <div className="ed-main">
                <div className="ed-toolbar">
                  <div className="tb-tabs">
                    <span className="tb-tab active">Editor</span>
                    <span className="tb-tab">Manus</span>
                    <span className="tb-tab">Analyse</span>
                  </div>
                  <div className="tb-right">
                    <span>1080p · 30fps</span>
                    <span>·</span>
                    <span>9:16</span>
                    <span className="render"><span className="pulse" />Render 62%</span>
                  </div>
                </div>

                <div className="ed-canvas">
                  <div className="ed-preview">
                    <div className="ep-scene">
                      <svg viewBox="0 0 280 498" preserveAspectRatio="xMidYMid slice">
                        <defs>
                          <linearGradient id="sk" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0" stopColor="#7ba9d8" />
                            <stop offset=".4" stopColor="#3d6fa3" />
                            <stop offset="1" stopColor="#0a1424" />
                          </linearGradient>
                        </defs>
                        <rect width="280" height="498" fill="url(#sk)" />
                        <path d="M0 290 L60 230 L120 270 L180 220 L240 260 L280 235 L280 380 L0 380 Z" fill="#1a3553" opacity=".7" />
                        <path d="M0 320 L80 290 L160 310 L240 280 L280 300 L280 380 L0 380 Z" fill="#0a1424" opacity=".85" />
                        <g transform="translate(50 260)">
                          <polygon points="0,30 90,-10 180,30" fill="#0a1424" />
                          <rect x="0" y="30" width="180" height="130" fill="#1a2a3e" />
                          <rect x="18" y="50" width="30" height="40" fill="#ffd591" opacity=".85" />
                          <rect x="62" y="50" width="30" height="40" fill="#ffd591" opacity=".5" />
                          <rect x="106" y="50" width="30" height="40" fill="#ffd591" opacity=".9" />
                          <rect x="150" y="50" width="20" height="40" fill="#ffd591" opacity=".4" />
                          <rect x="80" y="100" width="32" height="60" fill="#050810" />
                          <rect x="84" y="104" width="24" height="52" fill="#1a2a3e" />
                        </g>
                        <rect y="420" width="280" height="78" fill="#050810" />
                      </svg>
                    </div>
                    <div className="ep-overlay" />
                    <div className="ep-cap">«En sjelden mulighet i hjertet av Frogner...»</div>
                    <div className="ep-host">
                      <span className="av">S</span>
                      <span className="n">Sofia</span>
                    </div>
                    <div className="ep-info">
                      <div className="p">14 900 000 kr</div>
                      <div className="a">Bygdøy allé 24, Oslo</div>
                    </div>
                    <div className="ep-time"><span className="fill" /></div>
                  </div>
                </div>

                {/* timeline */}
                <div className="ed-timeline">
                  <div className="tl-ruler">
                    <span>0:00</span><span>0:15</span><span>0:30</span><span>0:45</span>
                    <span>1:00</span><span>1:15</span><span>1:30</span><span>1:45</span><span>2:00</span>
                  </div>
                  <div className="tl-track">
                    <span className="lbl"><span className="d" />Video</span>
                    <div className="row">
                      <span className="tl-clip" style={{ width: "24%" }}>intro.mp4</span>
                      <span className="tl-clip" style={{ width: "30%" }}>stue · 4k</span>
                      <span className="tl-clip" style={{ width: "22%" }}>kjøkken</span>
                      <span className="tl-clip" style={{ width: "18%" }}>utsikt</span>
                    </div>
                  </div>
                  <div className="tl-track t-host">
                    <span className="lbl"><span className="d" />Vert</span>
                    <div className="row">
                      <span className="tl-clip purple" style={{ width: "96%" }}>sofia · bokmål · skript v3</span>
                      <span className="tl-playhead" />
                    </div>
                  </div>
                  <div className="tl-track t-music">
                    <span className="lbl"><span className="d" />Musikk</span>
                    <div className="row">
                      <span className="tl-clip green" style={{ width: "96%" }}>nordlys.wav · 0db</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* right panel */}
              <div className="ed-right">
                <div className="rp-section">
                  <div className="lbl">Bolig</div>
                  <div className="rp-prop">
                    <div className="p">14 900 000 kr</div>
                    <div className="a">Bygdøy allé 24, 0265 Oslo</div>
                    <div className="specs">
                      <span>187 m²</span><span>4 sov</span><span>1894</span><span>P-rom</span>
                    </div>
                  </div>
                </div>

                <div className="rp-section">
                  <div className="lbl">Vert <button>Bytt →</button></div>
                  <div className="rp-avatars">
                    {AVATARS.map((av, i) => (
                      <div key={av.id} className={`av-tile${i === 0 ? ' active' : ''}`}>
                        <img src={`${R2}/${av.id}.jpg`} alt={av.name} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}} />
                        <span className="n">{av.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rp-section">
                  <div className="lbl">Innstillinger</div>
                  <div className="rp-row"><span className="k">Språk</span><span className="v">Bokmål</span></div>
                  <div className="rp-row"><span className="k">Stemme</span><span className="v">Sofia <span className="pill">AI</span></span></div>
                  <div className="rp-row"><span className="k">Tone</span><span className="v">Luksus</span></div>
                  <div className="rp-row"><span className="k">Lengde</span><span className="v">0:42</span></div>
                  <div className="rp-row"><span className="k">Format</span><span className="v">9:16</span></div>
                </div>

                <div className="rp-render">
                  <div className="t">Rendering pågår</div>
                  <div className="b"><span /></div>
                  <div className="m">62% · ca. 1:18 igjen</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────── LOGO BAR */}
      <section className="logos" style={{ padding: "48px 0", marginTop: 0 }}>
        <div className="wrap inner">
          <span className="label">Brukt daglig av meglere ved 340+ kontorer i Norge</span>
          <div className="row">
            <span className="l">Nordvik</span>
            <span className="l sm">DNB Eiendom</span>
            <span className="l">PrivatMegleren</span>
            <span className="l sm">EM 1</span>
            <span className="l">Krogsveen</span>
            <span className="l sm">Aktiv</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────── HOW IT WORKS */}
      <section id="hvordan">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow"><span className="dot" />Slik fungerer det</span>
            <h2>Fra prospekt til ferdig film.<br /><span style={{ color: "var(--muted)" }}>Tre steg, fem minutter.</span></h2>
          </div>

          <div className="steps">
            <div className="step">
              <div className="head"><span className="num">01</span><span className="time">~45 sek</span></div>
              <div className="vis">
                <div className="v1-drop">
                  <span className="ico">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </span>
                  <span className="t">Slipp filer her</span>
                  <span className="s">.jpg · .pdf · .mp4</span>
                </div>
                <div className="v1-files">
                  <div className="f"><span className="dot" />prospekt.pdf</div>
                  <div className="f"><span className="dot" />foto-stue.jpg</div>
                </div>
              </div>
              <h3>Last opp boligen</h3>
              <p>Bilder, salgsoppgave og nøkkeldata. Vi parser pris, adresse og takst automatisk fra prospektet.</p>
            </div>

            <div className="step">
              <div className="head"><span className="num">02</span><span className="time">~60 sek</span></div>
              <div className="vis">
                <div className="v2-grid">
                  <div className="v2-tile s1" />
                  <div className="v2-tile s2 on" />
                  <div className="v2-tile s3" />
                  <div className="v2-tile s4" />
                  <div className="v2-tile s5" />
                  <div className="v2-tile s6" />
                  <div className="v2-tile s7" />
                  <div className="v2-tile s8" />
                </div>
              </div>
              <h3>Velg vert og stemme</h3>
              <p>Tolv AI-avatarer, eller din egen stemmeklone. Manus genereres tilpasset boligens segment.</p>
            </div>

            <div className="step">
              <div className="head"><span className="num">03</span><span className="time">~3 min</span></div>
              <div className="vis">
                <div className="v3-formats">
                  <div className="v3-fmt vf-1 on" data-r="9:16">▾</div>
                  <div className="v3-fmt vf-2" data-r="16:9">▾</div>
                  <div className="v3-fmt vf-3" data-r="1:1">▾</div>
                </div>
              </div>
              <h3>Render og publiser</h3>
              <p>Ferdig film i alle formater, med kontorets logo og farger. Send rett til Finn, Instagram og TikTok.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────── FEATURES */}
      <section id="funksjoner" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow"><span className="dot" />Funksjoner</span>
            <h2>Et komplett filmstudio i nettleseren.</h2>
            <p>Alle moduler snakker sammen. Bytt vert, og leppesynk, manus og musikk justeres deretter — uten å starte på nytt.</p>
          </div>

          <div className="features">

            {/* Avatars — spans 4 cols */}
            <div className="feat feat-1">
              <div>
                <span className="eyebrow"><span className="dot" />Avatarbibliotek · 12 stk</span>
                <h3>Tolv profesjonelle AI-verter på norsk.</h3>
                <p className="desc">Innspilt med skuespillere i Oslo. Naturlig leppesynk, intonasjon og pauser — både bokmål og nynorsk.</p>
              </div>
              <div className="feat-vis">
                <div className="av-grid">
                  {AVATARS.map((av, i) => (
                    <div key={av.id} className={`av${i === 1 ? ' on' : ''}`}>
                      <img src={`${R2}/${av.id}.jpg`} alt={av.name} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}} />
                      <span className="l">{av.lang}</span>
                      <span className="n">{av.name}</span>
                      <span className="d">{av.desc}</span>
                    </div>
                  ))}
                  <div className="av"><span className="ph s7" /><span className="l">SE</span><span className="n">Astrid</span></div>
                  <div className="av"><span className="ph s8" /><span className="l">EN</span><span className="n">James</span></div>
                  <div className="av"><span className="ph s9" /><span className="l">NO·BM</span><span className="n">Tor</span></div>
                  <div className="av"><span className="ph s10" /><span className="l">NO·BM</span><span className="n">Linnea</span></div>
                  <div className="av"><span className="ph s11" /><span className="l">NO·NN</span><span className="n">Sigrid</span></div>
                  <div className="av"><span className="ph s12" /><span className="l">DA</span><span className="n">Frederik</span></div>
                </div>
              </div>
            </div>

            {/* Voice clone — spans 2 cols, dark */}
            <div className="feat feat-2 dark">
              <div>
                <span className="eyebrow"><span className="dot" />Stemmekloning</span>
                <h3>Din stemme.<br />I hver film.</h3>
                <p className="desc">Tre minutter opptak. Vi trener en personlig modell.</p>
              </div>
              <div className="feat-vis voice-vis">
                <span className="label on">REC</span>
                <div className="waveform">
                  {Array.from({ length: 48 }, (_, i) => (
                    <span
                      key={i}
                      style={{
                        animationDelay: `-${(i * 0.04).toFixed(2)}s`,
                        animationDuration: `${(1 + (i % 5) * 0.15).toFixed(2)}s`,
                        opacity: 0.6 + (i % 6) / 14,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Speed — spans 2 cols */}
            <div className="feat feat-3">
              <div>
                <span className="eyebrow"><span className="dot" />Hastighet</span>
                <h3>Tre dager → fem minutter.</h3>
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
                    <div className="bar"><span className="new" style={{ width: "3%" }} /></div>
                    <span className="v" style={{ color: "var(--blue)" }}>5 min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Music — spans 4 cols */}
            <div className="feat feat-4">
              <div>
                <span className="eyebrow"><span className="dot" />Musikkbibliotek · 400+ spor</span>
                <h3>Royalty-fritt, kuratert nordisk.</h3>
                <p className="desc">Tempo og klipping synkroniseres automatisk med musikken.</p>
              </div>
              <div className="feat-vis">
                <div className="tracks">
                  <div className="track on">
                    <span className="play" />
                    <span className="info">
                      <span className="n">Nordlys</span>
                      <span className="m">Ambient · Strykere · 80 BPM</span>
                    </span>
                    <span className="dur">02:42</span>
                  </div>
                  <div className="track">
                    <span className="play" />
                    <span className="info">
                      <span className="n">Fjorden Stiger</span>
                      <span className="m">Cinematic · Piano · 92 BPM</span>
                    </span>
                    <span className="dur">03:18</span>
                  </div>
                  <div className="track">
                    <span className="play" />
                    <span className="info">
                      <span className="n">Mørketid</span>
                      <span className="m">Lavmælt · Akustisk · 68 BPM</span>
                    </span>
                    <span className="dur">02:05</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─────────────────────────────────── PRICING */}
      <section id="priser">
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

      {/* ─────────────────────────────────── TESTIMONIALS */}
      <section id="kunder" className="testimonials">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow"><span className="dot" />Kunder</span>
            <h2>Brukt av meglere som vinner oppdrag.</h2>
          </div>

          <div className="q-grid">
            <div className="q-card tall">
              <p className="body">
                ReelHome har erstattet hele videoflyten vår. Jeg bruker fem minutter på å lage filmen som{" "}
                <em>tidligere tok tre dager hos byrå</em> — og resultatet ser bedre ut. Kundene merker det også.
              </p>
              <div>
                <div className="who">
                  <div className="av" />
                  <div>
                    <div className="name">Henrik Solberg</div>
                    <div className="role">Daglig leder · Solberg Eiendom</div>
                  </div>
                </div>
                <div className="logo-mini" style={{ marginTop: "14px" }}>Solberg Eiendom AS</div>
              </div>
            </div>

            <div className="q-card">
              <p className="body">Stemmeklonen min er så god at kundene tror <em>jeg har snakket inn det selv</em>.</p>
              <div className="who">
                <div className="av" style={{ background: "linear-gradient(135deg,#a78bfa,#6d28d9)" }} />
                <div>
                  <div className="name">Maria Bjørge</div>
                  <div className="role">Megler · Bergen Sentrum</div>
                </div>
              </div>
            </div>

            <div className="q-card">
              <p className="body"><em>240 % flere klikk</em> på Finn-annonsen etter vi byttet til ReelHome.</p>
              <div className="who">
                <div className="av" style={{ background: "linear-gradient(135deg,#fb923c,#c2410c)" }} />
                <div>
                  <div className="name">Erik Tønnessen</div>
                  <div className="role">Salgssjef · Nordvik Frogner</div>
                </div>
              </div>
            </div>

            <div className="q-card">
              <p className="body">Hele kontoret er på Pro-planen nå. Det betaler seg <em>tilbake første uka</em>.</p>
              <div className="who">
                <div className="av" style={{ background: "linear-gradient(135deg,#34d399,#065f46)" }} />
                <div>
                  <div className="name">Christine Lien</div>
                  <div className="role">Markedssjef · Krogsveen Trondheim</div>
                </div>
              </div>
            </div>

            <div className="q-card">
              <p className="body">Vi solgte <em>to tomter via Reels</em> i forrige uke. Helt nytt for oss.</p>
              <div className="who">
                <div className="av" style={{ background: "linear-gradient(135deg,#f472b6,#9d174d)" }} />
                <div>
                  <div className="name">Andreas Vik</div>
                  <div className="role">Megler · DNB Eiendom Stavanger</div>
                </div>
              </div>
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
      <section className="cta-final">
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

      {/* ─────────────────────────────────── FOOTER */}
      <footer className="landing-footer">
        <div className="wrap">
          <div className="foot-top">
            <div className="foot-brand">
              <a href="#" className="logo">
                { /* eslint-disable-next-line @next/next/no-img-element */ }
              <img src="/logo.png?v=1" alt="ReelHome" style={{ height: '40px', width: 'auto' }} />
              </a>
              <p>AI-drevet videoproduksjon for norske eiendomsmeglere. Bygget i Oslo.</p>
              <div className="foot-status"><span className="dot" />Alle systemer operative</div>
            </div>
            <div>
              <h4>Produkt</h4>
              <ul>
                <li><a href="#funksjoner">Funksjoner</a></li>
                <li><a href="#priser">Priser</a></li>
                <li><a href="#kunder">Kunder</a></li>
                <li><a href="#">Endringslogg</a></li>
                <li><a href="#">Veikart</a></li>
              </ul>
            </div>
            <div>
              <h4>Utviklere</h4>
              <ul>
                <li><a href="#">Dokumentasjon</a></li>
                <li><a href="#">API-referanse</a></li>
                <li><a href="#">Integrasjoner</a></li>
                <li><a href="#">Status</a></li>
              </ul>
            </div>
            <div>
              <h4>Selskap</h4>
              <ul>
                <li><a href="#">Om oss</a></li>
                <li><a href="#">Stillinger</a></li>
                <li><a href="#">Presse</a></li>
                <li><a href="#">Kontakt</a></li>
              </ul>
            </div>
            <div>
              <h4>Juridisk</h4>
              <ul>
                <li><a href="#">Personvern</a></li>
                <li><a href="#">Vilkår</a></li>
                <li><a href="#">DPA</a></li>
                <li><a href="#">Sikkerhet</a></li>
              </ul>
            </div>
          </div>
          <div className="foot-bot">
            <span>© 2026 ReelHome AS · Org. 932 415 880 · Akersgata 16, 0158 Oslo</span>
            <div className="links">
              <a href="#">X</a>
              <a href="#">LinkedIn</a>
              <a href="#">GitHub</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
