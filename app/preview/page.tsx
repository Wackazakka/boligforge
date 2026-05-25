// Temporary preview page — not covered by auth middleware
// Remove this file before deploying

export default function PreviewPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--ink)', fontFamily: 'var(--sans)' }}>

      {/* Nav */}
      <nav className="app-nav">
        <span className="app-nav-logo">ReelHome</span>
        <a className="app-nav-link active">Eiendommer</a>
        <a className="app-nav-link">Profil</a>
        <a className="app-nav-link">Fakturering</a>
        <button className="app-btn-ghost ml-auto text-xs">Logg ut</button>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">

        {/* Login card */}
        <div>
          <p className="app-label mb-4">Login</p>
          <div className="app-card max-w-sm" style={{ padding: '32px' }}>
            <h1 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--gold)', fontSize: '24px', marginBottom: '4px' }}>ReelHome</h1>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>Logg inn på din konto</p>
            <div className="space-y-4">
              <div>
                <label className="app-label">E-post</label>
                <input className="app-input" placeholder="din@epost.no" readOnly />
              </div>
              <div>
                <label className="app-label">Passord</label>
                <input className="app-input" type="password" placeholder="••••••••" readOnly />
              </div>
              <button className="app-btn-primary w-full">Logg inn</button>
              <button className="app-btn-ghost w-full text-xs text-center">Glemt passord?</button>
            </div>
          </div>
        </div>

        {/* Properties page */}
        <div>
          <p className="app-label mb-4">Eiendommer</p>
          <div className="mb-4 flex gap-3">
            <input className="app-input" placeholder="https://www.finn.no/realestate/homes/ad.html?finnkode=..." style={{ width: 'auto', flex: 1 }} readOnly />
            <button className="app-btn-primary">Hent annonse</button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {['Bygdøy allé 24', 'Majorstuen 12', 'Frogner Gate 8'].map((addr, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <div style={{ background: 'var(--surface-2)', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '32px' }}>🏠</div>
                <div style={{ padding: '16px' }}>
                  <p style={{ fontWeight: '600', color: 'var(--ink)', fontSize: '14px' }}>{addr}</p>
                  <p style={{ color: 'var(--gold)', fontWeight: '700', marginTop: '4px' }}>kr {(6200000 + i * 850000).toLocaleString('nb-NO')}</p>
                  <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '6px' }}>{95 + i * 20} m² · {3 + i} rom</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Billing */}
        <div>
          <p className="app-label mb-4">Fakturering</p>
          <div className="app-card max-w-xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <span className="app-badge-gold mb-2 inline-block">Pro</span>
                <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>kr 999/mnd</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: 'var(--muted)', fontSize: '12px' }}>Nullstilles</p>
                <p style={{ color: 'var(--ink-2)', fontSize: '14px', fontWeight: '500' }}>1. juni</p>
              </div>
            </div>
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ink-2)', fontSize: '14px' }}>Videoer brukt denne måneden</span>
              <span style={{ color: 'var(--ink)', fontWeight: '600' }}>7 / 20</span>
            </div>
            <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '999px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ height: '100%', width: '35%', background: 'var(--gold)', borderRadius: '999px' }} />
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '12px' }}>13 videoer igjen</p>
          </div>
        </div>

        {/* Admin */}
        <div>
          <p className="app-label mb-4">Admin — Meglere</p>
          <div className="max-w-2xl space-y-2">
            {[
              { name: 'Marius Lien', email: 'marius@krogsveen.no', role: 'admin' },
              { name: 'Sofia Bergmann', email: 'sofia@krogsveen.no', role: 'megler' },
              { name: 'Erik Holt', email: 'erik@krogsveen.no', role: 'megler' },
            ].map((m, i) => (
              <div key={i} className="flex items-center gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px 16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontWeight: '600', flexShrink: 0 }}>
                  {m.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'var(--ink)', fontSize: '14px', fontWeight: '500' }}>{m.name}</p>
                  <p style={{ color: 'var(--muted)', fontSize: '12px' }}>{m.email}</p>
                </div>
                <span className={m.role === 'admin' ? 'app-badge-gold' : 'app-badge-muted'}>{m.role === 'admin' ? 'Admin' : 'Megler'}</span>
                {m.role !== 'admin' && <button className="app-btn-danger">Fjern</button>}
              </div>
            ))}
          </div>
        </div>

        {/* Profile section preview */}
        <div>
          <p className="app-label mb-4">Profil — Stemme</p>
          <div className="app-card max-w-xl space-y-3">
            {['Øyvind – Dyp og rolig', 'Dennis – Klar og behagelig', 'Johannes – Selvsikker'].map((v, i) => (
              <button key={i} className={`app-voice-row${i === 0 ? ' active' : ''}`}>
                <span>{v}</span>
                <span style={{ color: 'var(--muted)', fontSize: '12px' }}>▶ Hør</span>
              </button>
            ))}
          </div>
        </div>

        {/* Buttons & components */}
        <div>
          <p className="app-label mb-4">Komponenter</p>
          <div className="flex flex-wrap gap-3 items-center">
            <button className="app-btn-primary">Generer manus</button>
            <button className="app-btn-secondary">Del opp i segmenter</button>
            <button className="app-btn-ghost">← Tilbake</button>
            <button className="app-btn-danger">Fjern</button>
            <span className="app-badge-gold">Pro</span>
            <span className="app-badge-muted">Megler</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="app-error">Feil e-post eller passord.</div>
            <div className="app-success">✓ Lagret!</div>
            <div className="app-info">
              <svg className="animate-spin h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Genererer avatar-video…
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
