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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Eiendommer</h1>
          <p className="text-gray-500 mt-1">Lim inn en Finn.no-annonse for å hente inn boligdata</p>
        </div>

        {/* Scrape form */}
        <form onSubmit={handleScrape} className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.finn.no/realestate/homes/ad.html?finnkode=..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={scraping || !url.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {scraping ? 'Henter...' : 'Hent annonse'}
          </button>
        </form>

        {scrapeError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            {scrapeError}
          </p>
        )}

        {/* Property grid */}
        {loading ? (
          <p className="text-sm text-gray-400">Laster eiendommer...</p>
        ) : properties.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🏠</p>
            <p>Ingen eiendommer ennå. Lim inn en Finn.no-lenke over.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {properties.map(p => (
              <div key={p.id} onClick={() => router.push(`/dashboard/properties/${p.id}`)} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                {p.images?.[0] ? (
                  <img
                    src={p.images[0]}
                    alt={p.address}
                    className="w-full h-44 object-cover"
                  />
                ) : (
                  <div className="w-full h-44 bg-gray-100 flex items-center justify-center text-gray-300 text-3xl">🏠</div>
                )}
                <div className="p-4 space-y-1">
                  <p className="font-semibold text-gray-900 text-sm leading-snug">{p.address || '—'}</p>
                  <p className="text-blue-600 font-bold">{formatPrice(p.price)}</p>
                  <div className="flex gap-3 text-xs text-gray-500 mt-2">
                    {p.size_bra && <span>{p.size_bra} m²</span>}
                    {p.rooms && <span>{p.rooms} rom</span>}
                  </div>
                  <a
                    href={p.finn_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-gray-400 hover:text-blue-500 transition-colors"
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
