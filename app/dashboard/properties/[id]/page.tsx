'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Property = {
  id: string
  finn_id: string
  address: string
  title: string | null
  price: number | null
  price_total: number | null
  shared_debt: number | null
  shared_costs: number | null
  size_bra: number | null
  rooms: number | null
  bedrooms: number | null
  floor: number | null
  build_year: number | null
  property_type: string | null
  ownership_type: string | null
  energy_label: string | null
  plot_area: number | null
  facilities: string[] | null
  summary: string | null
  images: string[]
  finn_url: string
}

type AgentProfile = {
  name?: string
  voice_id?: string
  tone_of_voice?: string
  portrait_url?: string
}

type SettingImage = {
  setting_type: string
  image_url: string
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [property, setProperty] = useState<Property | null>(null)
  const [profile, setProfile] = useState<AgentProfile>({})
  const [settingImages, setSettingImages] = useState<SettingImage[]>([])
  const [selectedSetting, setSelectedSetting] = useState<string>('')
  const [script, setScript] = useState('')
  const [generatingScript, setGeneratingScript] = useState(false)
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)

  useEffect(() => {
    fetch(`/api/properties/get?id=${id}`).then(r => r.json()).then(setProperty)
    fetch('/api/profile/get').then(r => r.json()).then(setProfile)
    fetch('/api/profile/settings-images').then(r => r.json()).then((d: SettingImage[]) => {
      if (Array.isArray(d)) {
        setSettingImages(d)
        if (d.length > 0) setSelectedSetting(d[0].setting_type)
      }
    })
  }, [id])

  async function handleGenerateScript() {
    if (!property) return
    setGeneratingScript(true)
    setError('')
    const res = await fetch('/api/properties/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property, agentProfile: profile }),
    })
    const data = await res.json()
    setGeneratingScript(false)
    if (data.error) setError(data.error)
    else setScript(data.script)
  }

  async function handleGenerateVideo() {
    if (!script || !profile.voice_id) {
      setError('Mangler manus eller stemme-ID i profilen')
      return
    }
    const avatarImg = settingImages.find(s => s.setting_type === selectedSetting)?.image_url
    if (!avatarImg) {
      setError('Velg et avatar-bilde under')
      return
    }

    setGeneratingVideo(true)
    setError('')
    setVideoUrl(null)

    setStatusMsg('Genererer tale med ElevenLabs...')
    const res = await fetch('/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: id,
        script,
        voiceId: profile.voice_id,
        avatarImageUrl: avatarImg,
        propertyImages: property?.images?.slice(0, 8) || [],
      }),
    })

    const data = await res.json()
    setGeneratingVideo(false)
    setStatusMsg('')

    if (data.error) setError(data.error)
    else setVideoUrl(data.videoUrl)
  }

  function formatPrice(p: number | null) {
    if (!p) return '—'
    return new Intl.NumberFormat('nb-NO').format(p) + ' kr'
  }

  if (!property) return <div className="p-8 text-gray-400">Laster...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-700">← Tilbake</button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{property.title || property.address}</h1>
            <p className="text-sm text-gray-500">{property.address}</p>
          </div>
        </div>

        {/* Image gallery */}
        {property.images?.length > 0 && (
          <div className="space-y-2">
            <img src={property.images[selectedImageIdx]} alt="" className="w-full h-64 object-cover rounded-xl" />
            <div className="flex gap-2 overflow-x-auto pb-1">
              {property.images.slice(0, 12).map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt=""
                  onClick={() => setSelectedImageIdx(i)}
                  className={`w-16 h-12 object-cover rounded cursor-pointer flex-shrink-0 border-2 transition-colors ${i === selectedImageIdx ? 'border-blue-500' : 'border-transparent'}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Key facts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Prisantydning', value: formatPrice(property.price) },
            { label: 'Totalpris', value: formatPrice(property.price_total) },
            { label: 'BRA', value: property.size_bra ? `${property.size_bra} m²` : '—' },
            { label: 'Rom / Soverom', value: property.rooms ? `${property.rooms} / ${property.bedrooms ?? '?'}` : '—' },
            { label: 'Byggeår', value: property.build_year ?? '—' },
            { label: 'Boligtype', value: property.property_type ?? '—' },
            { label: 'Eierform', value: property.ownership_type ?? '—' },
            { label: 'Energimerke', value: property.energy_label ?? '—' },
          ].map(f => (
            <div key={f.label} className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-400">{f.label}</p>
              <p className="font-semibold text-gray-900 text-sm">{String(f.value)}</p>
            </div>
          ))}
        </div>

        {/* Facilities */}
        {property.facilities?.length ? (
          <div className="flex flex-wrap gap-2">
            {property.facilities.map(f => (
              <span key={f} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{f}</span>
            ))}
          </div>
        ) : null}

        {/* Script section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Presentasjonsmanus</h2>
            <button
              onClick={handleGenerateScript}
              disabled={generatingScript}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generatingScript ? 'Genererer...' : script ? 'Regenerer' : 'Generer manus'}
            </button>
          </div>
          <textarea
            value={script}
            onChange={e => setScript(e.target.value)}
            placeholder="Trykk «Generer manus» for å lage et AI-generert presentasjonsmanus basert på boligdataene..."
            rows={8}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {script && (
            <p className="text-xs text-gray-400">{script.split(/\s+/).length} ord · ca. {Math.round(script.split(/\s+/).length / 2.5)} sek</p>
          )}
        </div>

        {/* Avatar picker */}
        {settingImages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h2 className="font-semibold text-gray-900">Velg avatar-bilde</h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {settingImages.map(s => (
                <div
                  key={s.setting_type}
                  onClick={() => setSelectedSetting(s.setting_type)}
                  className={`flex-shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${selectedSetting === s.setting_type ? 'border-blue-500' : 'border-transparent'}`}
                >
                  <img src={s.image_url} alt={s.setting_type} className="w-24 h-32 object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generate video button */}
        <div className="space-y-3">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>
          )}
          {statusMsg && (
            <p className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">{statusMsg}</p>
          )}
          <button
            onClick={handleGenerateVideo}
            disabled={generatingVideo || !script}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generatingVideo ? 'Genererer video...' : 'Generer presentasjonsvideo'}
          </button>
        </div>

        {/* Video result */}
        {videoUrl && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Ferdig video</h2>
            <video src={videoUrl} controls className="w-full rounded-lg" />
            <a
              href={videoUrl}
              download
              className="inline-block text-sm text-blue-600 hover:underline"
            >
              Last ned video
            </a>
          </div>
        )}

      </div>
    </div>
  )
}
