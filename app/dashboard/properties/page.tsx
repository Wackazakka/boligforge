'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProductTour, { runTourOnce } from '@/app/components/ProductTour'

const TOUR_EMPTY_KEY = 'rh_tour_properties_empty'
const TOUR_CARD_KEY = 'rh_tour_properties_card'

type Property = {
  id: string
  finn_id: string
  address: string
  price: number | null
  size_bra: number | null
  rooms: number | null
  images: string[]
  finn_url: string
  hjem_url?: string | null
  status: 'active' | 'sold'
  sold_at: string | null
}

export default function PropertiesPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [showSold, setShowSold] = useState(false)
  const [sellingId, setSellingId] = useState<string | null>(null)

  useEffect(() => { loadProperties() }, [])

  async function loadProperties() {
    setLoading(true)
    try {
      const res = await fetch('/api/properties/list')
      if (res.ok) setProperties(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setScraping(true)
    setScrapeError('')
    try {
      const res = await fetch('/api/properties/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.scrapeId) {
        setScrapeError(data.error || 'Scraping feilet')
      } else {
        // Poll til worker er ferdig (hjem.no + mange bilder kan ta ~1 min)
        let finished = false
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 3000))
          const st = await fetch(`/api/properties/scrape?id=${data.scrapeId}`).then(r => r.json()).catch(() => null)
          if (st?.status === 'done') { finished = true; break }
          if (st?.status === 'error') { setScrapeError(st.error || 'Scraping feilet'); finished = true; break }
        }
        if (!finished) setScrapeError('Hentingen tok for lang tid — prøv å laste siden på nytt om litt.')
        setUrl('')
        await loadProperties()
      }
    } catch (err) { setScrapeError(String(err)) }
    finally { setScraping(false) }
  }

  async function handleMarkSold(e: React.MouseEvent, propertyId: string) {
    e.stopPropagation()
    if (!confirm('Marker denne boligen som solgt? Videoene flyttes til «Solgte»-mappen.')) return
    setSellingId(propertyId)
    try {
      const res = await fetch('/api/properties/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      })
      if (res.ok) await loadProperties()
    } finally { setSellingId(null) }
  }

  function formatPrice(price: number | null) {
    if (!price) return '—'
    return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(price)
  }

  const active = properties.filter(p => p.status !== 'sold')
  const sold   = properties.filter(p => p.status === 'sold')

  // Vis "klikk på boligen"-tipset første gang brukeren har minst én eiendom.
  useEffect(() => {
    if (!loading && active.length > 0) {
      const t = setTimeout(() => runTourOnce(TOUR_CARD_KEY, [{
        selector: '[data-tour="property-card"]',
        title: 'Klikk på boligen',
        description: 'Trykk på et boligkort for å lage videoen — velg bilder, skriv manus og generer.',
      }]), 150)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, active.length])

  function PropertyCard({ p, isSold }: { p: Property; isSold: boolean }) {
    return (
      <div
        onClick={() => !isSold && router.push(`/dashboard/properties/${p.id}`)}
        data-tour={!isSold ? 'property-card' : undefined}
        className="rounded-xl overflow-hidden transition-all"
        style={{
          background:  'var(--surface)',
          border:      '1px solid var(--line)',
          cursor:      isSold ? 'default' : 'pointer',
          opacity:     isSold ? 0.5 : 1,
          filter:      isSold ? 'grayscale(1)' : 'none',
          position:    'relative',
        }}
        onMouseEnter={e => { if (!isSold) e.currentTarget.style.borderColor = 'var(--line-2)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)' }}
      >
        {/* Sold badge */}
        {isSold && (
          <div style={{
            position: 'absolute', top: '10px', left: '10px', zIndex: 2,
            background: '#333', color: '#fff',
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
            padding: '3px 8px', borderRadius: '6px',
          }}>
            SOLGT
          </div>
        )}

        {p.images?.[0] ? (
          <img src={p.images[0]} alt={p.address} className="w-full h-44 object-cover" />
        ) : (
          <div className="w-full h-44 flex items-center justify-center text-3xl"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>🏠</div>
        )}

        <div className="p-4 space-y-1">
          <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--ink)' }}>
            {p.address || '—'}
          </p>
          <p className="font-bold" style={{ color: 'var(--gold)' }}>{formatPrice(p.price)}</p>
          <div className="flex gap-3 text-xs mt-2" style={{ color: 'var(--muted)' }}>
            {p.size_bra && <span>{p.size_bra} m²</span>}
            {p.rooms && <span>{p.rooms} rom</span>}
          </div>

          <div className="flex items-center justify-between mt-2">
            <a
              href={p.hjem_url || p.finn_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs transition-colors"
              style={{ color: 'var(--muted)' }}
              onClick={e => e.stopPropagation()}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              {p.hjem_url ? `Hjem.no #${p.finn_id}` : `Finn.no #${p.finn_id}`} ↗
            </a>

            {!isSold && (
              <button
                onClick={e => handleMarkSold(e, p.id)}
                disabled={sellingId === p.id}
                style={{
                  fontSize: '11px', color: 'var(--muted)',
                  background: 'none', border: 'none',
                  cursor: 'pointer', padding: '2px 6px',
                  borderRadius: '4px', transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--surface-2)'
                  e.currentTarget.style.color = 'var(--ink)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'none'
                  e.currentTarget.style.color = 'var(--muted)'
                }}
              >
                {sellingId === p.id ? '…' : 'Marker som solgt'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
              Eiendommer
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              Lim inn en Finn.no- eller Hjem.no-annonse for å hente inn boligdata — klikk deretter på eiendommen du vil lage video for
            </p>
          </div>
          <button
            type="button"
            title="Vis en rask gjennomgang"
            onClick={() => {
              try {
                window.localStorage.removeItem(TOUR_EMPTY_KEY)
                window.localStorage.removeItem(TOUR_CARD_KEY)
              } catch { /* ignore */ }
              runTourOnce(TOUR_EMPTY_KEY, [
                {
                  selector: '[data-tour="scrape-url"]',
                  title: 'Lim inn boligannonsen',
                  description: 'Lim inn lenken til Finn.no- eller Hjem.no-annonsen for boligen du vil lage video for.',
                },
                {
                  selector: '[data-tour="scrape-button"]',
                  title: 'Hent annonsen',
                  description: 'Trykk her for å hente inn bilder, pris og fakta fra annonsen automatisk.',
                },
              ])
            }}
            className="app-btn-ghost text-xs"
            style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ?
          </button>
        </div>

        {/* Scrape form */}
        <form onSubmit={handleScrape} className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.finn.no/... eller https://hjem.no/property/..."
            className="app-input flex-1 min-w-0"
            style={{ width: 'auto' }}
            data-tour="scrape-url"
          />
          <button type="submit" disabled={scraping || !url.trim()} className="app-btn-primary" data-tour="scrape-button">
            {scraping ? 'Henter...' : 'Hent annonse'}
          </button>
        </form>

        <ProductTour
          storageKey={TOUR_EMPTY_KEY}
          when={!loading && active.length === 0}
          steps={[
            {
              selector: '[data-tour="scrape-url"]',
              title: 'Lim inn boligannonsen',
              description: 'Lim inn lenken til Finn.no- eller Hjem.no-annonsen for boligen du vil lage video for.',
            },
            {
              selector: '[data-tour="scrape-button"]',
              title: 'Hent annonsen',
              description: 'Trykk her for å hente inn bilder, pris og fakta fra annonsen automatisk.',
            },
          ]}
        />

        {scrapeError && <div className="app-error">{scrapeError}</div>}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Laster eiendommer...</p>
        ) : properties.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
            <p className="text-4xl mb-3">🏠</p>
            <p>Ingen eiendommer ennå. Lim inn en Finn.no- eller Hjem.no-lenke over.</p>
          </div>
        ) : (
          <>
            {/* Active properties */}
            {active.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {active.map(p => <PropertyCard key={p.id} p={p} isSold={false} />)}
              </div>
            )}

            {active.length === 0 && sold.length > 0 && (
              <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
                Ingen aktive eiendommer
              </p>
            )}

            {/* Sold toggle */}
            {sold.length > 0 && (
              <div>
                <button
                  onClick={() => setShowSold(v => !v)}
                  className="text-sm flex items-center gap-2"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', padding: 0,
                  }}
                >
                  <span style={{
                    display: 'inline-block', width: '14px', height: '14px',
                    transition: 'transform 0.2s',
                    transform: showSold ? 'rotate(90deg)' : 'rotate(0deg)',
                    fontSize: '12px',
                  }}>▶</span>
                  Solgte ({sold.length})
                </button>

                {showSold && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
                    {sold.map(p => <PropertyCard key={p.id} p={p} isSold={true} />)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
