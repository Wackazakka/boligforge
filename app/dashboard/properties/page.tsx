'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Property = {
  id: string
  finn_id: string
  address: string
  price: number | null
  size_bra: number | null
  rooms: number | null
  images: string[]
  finn_url: string
}

export default function PropertiesPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProperties()
  }, [])

  async function loadProperties() {
    setLoading(true)
    try {
      const res = await fetch('/api/properties/list')
      if (res.ok) setProperties(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
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
      if (!res.ok) {
        setScrapeError(data.error || 'Scraping feilet')
      } else {
        setUrl('')
        await loadProperties()
      }
    } catch (err) {
      setScrapeError(String(err))
    } finally {
      setScraping(false)
    }
  }

  function formatPrice(price: number | null) {
    if (!price) return '—'
    return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(price)
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--ink)', fontFamily: 'var(--sans)' }}
          >
            Eiendommer
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Lim inn en Finn.no-annonse for å hente inn boligdata
          </p>
        </div>

        {/* Scrape form */}
        <form onSubmit={handleScrape} className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.finn.no/realestate/homes/ad.html?finnkode=..."
            className="app-input flex-1"
            style={{ width: 'auto' }}
          />
          <button
            type="submit"
            disabled={scraping || !url.trim()}
            className="app-btn-primary"
          >
            {scraping ? 'Henter...' : 'Hent annonse'}
          </button>
        </form>

        {scrapeError && <div className="app-error">{scrapeError}</div>}

        {/* Property grid */}
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Laster eiendommer...</p>
        ) : properties.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
            <p className="text-4xl mb-3">🏠</p>
            <p>Ingen eiendommer ennå. Lim inn en Finn.no-lenke over.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {properties.map(p => (
              <div
                key={p.id}
                onClick={() => router.push(`/dashboard/properties/${p.id}`)}
                className="rounded-xl overflow-hidden cursor-pointer transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--line-2)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
              >
                {p.images?.[0] ? (
                  <img
                    src={p.images[0]}
                    alt={p.address}
                    className="w-full h-44 object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-44 flex items-center justify-center text-3xl"
                    style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                  >
                    🏠
                  </div>
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
                  <a
                    href={p.finn_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs transition-colors"
                    style={{ color: 'var(--muted)' }}
                    onClick={e => e.stopPropagation()}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                  >
                    Finn.no #{p.finn_id} ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
