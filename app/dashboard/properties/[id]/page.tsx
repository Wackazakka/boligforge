'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { fal } from '@fal-ai/client'

fal.config({ proxyUrl: '/api/fal/proxy' })

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
  id: string
  setting_type: string
  image_url: string
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [property, setProperty] = useState<Property | null>(null)
  const [profile, setProfile] = useState<AgentProfile>({})
  const [settingImages, setSettingImages] = useState<SettingImage[]>([])
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>('')
  const [generatingAvatar, setGeneratingAvatar] = useState(false)
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string | null>(null)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarSaved, setAvatarSaved] = useState(false)
  const [script, setScript] = useState('')
  const [generatingScript, setGeneratingScript] = useState(false)
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [selectedVideoImages, setSelectedVideoImages] = useState<string[]>([])
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch(`/api/properties/get?id=${id}`).then(r => r.json()).then((p: Property) => {
      setProperty(p)
      setSelectedVideoImages((p.images || []).slice(0, 8))
    })
    fetch('/api/profile/get').then(r => r.json()).then(setProfile)
    fetch('/api/profile/settings-images').then(r => r.json()).then((d: SettingImage[]) => {
      if (Array.isArray(d)) {
        setSettingImages(d)
        if (d.length > 0) setSelectedAvatarUrl(d[0].image_url)
      }
    })
  }, [id])

  async function handleSaveAvatar() {
    if (!generatedAvatarUrl) return
    setSavingAvatar(true)
    try {
      const res = await fetch('/api/profile/save-generated-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ falImageUrl: generatedAvatarUrl, setting: 'property_front' }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        setSettingImages(prev => [...prev, { id: data.id || data.url, setting_type: 'property_front', image_url: data.url }])
        setAvatarSaved(true)
        setTimeout(() => setAvatarSaved(false), 3000)
      }
    } finally {
      setSavingAvatar(false)
    }
  }

  async function handleDeleteSettingImage(img: SettingImage) {
    if (!confirm('Slett dette avatarbildet?')) return
    await fetch('/api/profile/delete-setting-image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: img.id, imageUrl: img.image_url }),
    })
    setSettingImages(prev => prev.filter(s => s.id !== img.id))
    if (selectedAvatarUrl === img.image_url) setSelectedAvatarUrl('')
  }

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

  async function handleGenerateAvatar() {
    if (!profile.portrait_url) { setError('Last opp et portrettbilde i profilen din først'); return }
    if (!property?.images?.length) { setError('Ingen boligbilder tilgjengelig'); return }
    const propertyImg = property.images[selectedImageIdx]
    setGeneratingAvatar(true)
    setError('')
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await fal.subscribe('fal-ai/omnigen-v1', {
        input: {
          input_image_urls: [profile.portrait_url, propertyImg],
          prompt: 'A professional real estate agent from <img><|image_1|></img> standing confidently in front of the exact house from <img><|image_2|></img>. Preserve the building architecture, facade, colors and surroundings from image 2 exactly. The agent wears business casual attire, natural confident expression. Editorial real estate photography, natural lighting.',
          num_images: 1,
          guidance_scale: 3.5,
          img_guidance_scale: 2.2,
          num_inference_steps: 20,
          image_size: 'landscape_16_9' as const,
        },
        pollInterval: 3000,
      })
      const url = result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url
      if (!url) { setError('Ingen bilde returnert fra fal.ai'); return }
      setGeneratedAvatarUrl(url)
      setSelectedAvatarUrl(url)
    } catch (err) {
      setError('Avatar-generering feilet: ' + String(err))
    } finally {
      setGeneratingAvatar(false)
    }
  }

  const STATUS_LABELS: Record<string, string> = {
    queued: 'Venter i kø...',
    tts: 'Genererer tale med ElevenLabs...',
    lipsync: 'Genererer avatar-video med VEED Fabric...',
    assembling: 'Setter sammen video med boligbilder...',
    uploading: 'Laster opp ferdig video...',
    done: 'Ferdig!',
    failed: 'Noe gikk galt.',
  }

  function startPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/video/status/${jobId}`)
        const data = await res.json()
        const label = STATUS_LABELS[data.status] || `Status: ${data.status}`
        setStatusMsg(label)
        if (data.status === 'done') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setGeneratingVideo(false)
          setActiveJobId(null)
          setStatusMsg('')
          setVideoUrl(data.videoUrl)
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setGeneratingVideo(false)
          setActiveJobId(null)
          setStatusMsg('')
          setError(data.error || 'Video-generering feilet')
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 3000)
  }

  async function handleGenerateVideo() {
    if (!script || !profile.voice_id) {
      setError('Mangler manus eller stemme-ID i profilen')
      return
    }
    if (!selectedAvatarUrl) {
      setError('Velg et avatar-bilde under')
      return
    }

    setGeneratingVideo(true)
    setError('')
    setVideoUrl(null)
    setStatusMsg('Sender til worker...')

    const res = await fetch('/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: id,
        script,
        voiceId: profile.voice_id,
        avatarImageUrl: selectedAvatarUrl,
        propertyImages: selectedVideoImages,
      }),
    })

    const data = await res.json()
    if (data.error) {
      setGeneratingVideo(false)
      setStatusMsg('')
      setError(data.error)
      return
    }

    setActiveJobId(data.jobId)
    setStatusMsg(STATUS_LABELS['queued'])
    startPolling(data.jobId)
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
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Velg avatar-bilde</h2>

          {/* Library: saved settings from profile */}
          {settingImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fra profilen din</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {settingImages.map(s => (
                  <div
                    key={s.image_url}
                    className={`relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${selectedAvatarUrl === s.image_url ? 'border-blue-500' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  >
                    <img
                      src={s.image_url}
                      alt={s.setting_type}
                      onClick={() => setSelectedAvatarUrl(s.image_url)}
                      className="w-24 h-32 object-cover cursor-pointer"
                    />
                    <button
                      onClick={() => handleDeleteSettingImage(s)}
                      title="Slett bilde"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 hover:bg-red-600 flex items-center justify-center text-white text-xs transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate avatar in front of this property */}
          {property.images?.length > 0 && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Foran denne boligen</p>
              <p className="text-xs text-gray-400">Velg hvilke boligbilde du vil stå foran, og generer et nytt avatarbilde.</p>

              {/* Property image selector — reuses selectedImageIdx from gallery */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {property.images.slice(0, 12).map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt=""
                    onClick={() => setSelectedImageIdx(i)}
                    className={`w-16 h-12 object-cover rounded cursor-pointer flex-shrink-0 border-2 transition-colors ${i === selectedImageIdx ? 'border-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateAvatar}
                  disabled={generatingAvatar || !profile.portrait_url}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {generatingAvatar && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {generatingAvatar ? 'Genererer (~30 sek)...' : generatedAvatarUrl ? '↺ Regenerer' : 'Generer foran denne boligen'}
                </button>
                {!profile.portrait_url && (
                  <p className="text-xs text-gray-400">Last opp portrett i profilen din først</p>
                )}
              </div>

              {/* Show generated result + select + save */}
              {generatedAvatarUrl && (
                <div className="flex items-end gap-3">
                  <div
                    onClick={() => setSelectedAvatarUrl(generatedAvatarUrl)}
                    className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${selectedAvatarUrl === generatedAvatarUrl ? 'border-blue-500' : 'border-gray-200 opacity-80 hover:opacity-100'}`}
                  >
                    <img src={generatedAvatarUrl} alt="Generert avatar" className="w-48 h-32 object-cover" />
                    <p className="text-xs text-center text-gray-500 py-1">
                      {selectedAvatarUrl === generatedAvatarUrl ? '✓ Valgt' : 'Klikk for å velge'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 pb-1">
                    <button
                      onClick={handleSaveAvatar}
                      disabled={savingAvatar}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {savingAvatar ? 'Lagrer...' : avatarSaved ? '✓ Lagret' : 'Lagre til bibliotek'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {settingImages.length === 0 && !property.images?.length && (
            <p className="text-sm text-gray-400">Gå til Profil for å generere setting-bilder.</p>
          )}
        </div>

        {/* Property image picker for video */}
        {property.images?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Velg bilder til video</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedVideoImages.length} av {property.images.length} valgt · Klikk for å velge/fjerne
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedVideoImages(property.images.slice(0, 8))}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Velg alle
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => setSelectedVideoImages([])}
                  className="text-xs text-gray-400 hover:underline"
                >
                  Fjern alle
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {property.images.map((img, i) => {
                const isSelected = selectedVideoImages.includes(img)
                return (
                  <div
                    key={i}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedVideoImages(prev => prev.filter(u => u !== img))
                      } else {
                        setSelectedVideoImages(prev => [...prev, img])
                      }
                    }}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-blue-500 opacity-100' : 'border-transparent opacity-40 hover:opacity-70'}`}
                  >
                    <img src={img} alt="" className="w-20 h-14 object-cover" />
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Generate video button */}
        <div className="space-y-3">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>
          )}
          {generatingVideo && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <svg className="animate-spin h-4 w-4 text-blue-600 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>{statusMsg || 'Jobber...'}</span>
              </div>
              {activeJobId && (
                <p className="text-xs text-gray-400 text-center">Jobb-ID: {activeJobId}</p>
              )}
            </div>
          )}
          {!generatingVideo && statusMsg && (
            <p className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">{statusMsg}</p>
          )}
          <button
            onClick={handleGenerateVideo}
            disabled={generatingVideo || !script || selectedVideoImages.length === 0}
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
