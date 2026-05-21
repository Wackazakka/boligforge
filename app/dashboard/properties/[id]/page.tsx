'use client'

import { useEffect, useRef, useState } from 'react'
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

type Segment = {
  id: number
  text: string
  type: 'avatar' | 'image'
  imageUrl?: string
  previewingAudio?: boolean
  previewAudioUrl?: string
}

type Outro = {
  images: string[]
  musicUrl: string
  durationPerImage: number
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
  const [cachedCutoutUrl, setCachedCutoutUrl] = useState<string | null>(null)
  const [cutoutSourceUrl, setCutoutSourceUrl] = useState<string | null>(null)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarSaved, setAvatarSaved] = useState(false)
  const [script, setScript] = useState('')
  const [generatingScript, setGeneratingScript] = useState(false)
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [selectedVideoImages, setSelectedVideoImages] = useState<string[]>([])
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [outro, setOutro] = useState<Outro>({ images: [], musicUrl: '', durationPerImage: 4 })
  const [musicFiles, setMusicFiles] = useState<{ id: string; name: string; url: string }[]>([])
  const [uploadingMusic, setUploadingMusic] = useState(false)
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
    fetch('/api/music').then(r => r.json()).then(d => {
      if (Array.isArray(d.files)) setMusicFiles(d.files)
    })
  }, [id])

  function splitIntoSegments(text: string) {
    const raw = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [text]
    const sentences = raw.map(s => s.trim()).filter(s => s.length > 0)
    const result: Segment[] = []
    let i = 0
    while (i < sentences.length) {
      const words = sentences[i].split(/\s+/).filter(Boolean).length
      if (words < 5 && i + 1 < sentences.length) {
        result.push({ id: result.length, text: `${sentences[i]} ${sentences[i + 1]}`, type: 'avatar' })
        i += 2
      } else {
        result.push({ id: result.length, text: sentences[i], type: 'avatar' })
        i++
      }
    }
    return result
  }

  function handleSplitSegments() {
    if (!script) return
    setSegments(splitIntoSegments(script))
    setOutro({ images: [], musicUrl: '', durationPerImage: 4 })
  }

  function updateSegment(idx: number, patch: Partial<Segment>) {
    setSegments(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  async function generateSegmentAudio(idx: number): Promise<string | null> {
    if (!profile.voice_id) { setError('Ingen stemme valgt i profilen'); return null }
    updateSegment(idx, { previewingAudio: true })
    try {
      const res = await fetch('/api/profile/tts-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: segments[idx].text, voiceId: profile.voice_id }),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      updateSegment(idx, { previewAudioUrl: url })
      return url
    } catch (e) {
      setError(`TTS-feil: ${String(e)}`)
      return null
    } finally {
      updateSegment(idx, { previewingAudio: false })
    }
  }

  async function handlePlaySegmentAudio(idx: number) {
    const seg = segments[idx]
    const url = seg.previewAudioUrl ?? await generateSegmentAudio(idx)
    if (url) new Audio(url).play().catch(() => setError('Kunne ikke spille av lyd'))
  }

  async function handleRegenSegmentAudio(idx: number) {
    const url = await generateSegmentAudio(idx)
    if (url) new Audio(url).play().catch(() => setError('Kunne ikke spille av lyd'))
  }

  async function handleMusicUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingMusic(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/music/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Opplasting feilet')
      const newFile = { id: data.id || String(Date.now()), name: data.name, url: data.url }
      setMusicFiles(prev => [newFile, ...prev])
      setOutro(o => ({ ...o, musicUrl: data.url }))
    } catch (err) {
      setError(`Musikk-opplasting feilet: ${String(err)}`)
    } finally {
      setUploadingMusic(false)
      e.target.value = ''
    }
  }

  async function handleDeleteMusic(id: string, url: string) {
    await fetch('/api/music', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setMusicFiles(prev => prev.filter(f => f.id !== id))
    if (outro.musicUrl === url) setOutro(o => ({ ...o, musicUrl: '' }))
  }

  async function handleSaveAvatar() {
    // Image is already saved to library by composite-avatar route
    setAvatarSaved(true)
    setTimeout(() => setAvatarSaved(false), 3000)
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
    setAvatarSaved(false)
    setError('')
    try {
      // Use selected avatar (has shoulders) or fall back to portrait
      const agentSourceUrl = selectedAvatarUrl || profile.portrait_url
      // Invalidate cutout cache if source image changed
      const reuseCutout = cachedCutoutUrl && cutoutSourceUrl === agentSourceUrl ? cachedCutoutUrl : null

      const res = await fetch('/api/profile/composite-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portraitUrl: agentSourceUrl,
          propertyImageUrl: propertyImg,
          cutoutUrl: reuseCutout,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'Komposisjon feilet'); return }
      setGeneratedAvatarUrl(data.url)
      setSelectedAvatarUrl(data.url)
      if (data.cutoutUrl) {
        setCachedCutoutUrl(data.cutoutUrl)
        setCutoutSourceUrl(agentSourceUrl ?? null)
      }
      // Already saved to Supabase by the route — add to local list
      if (data.id) {
        setSettingImages(prev => [...prev, { id: data.id, setting_type: 'property_front', image_url: data.url }])
      }
    } catch (err) {
      setError('Avatar-generering feilet: ' + String(err))
    } finally {
      setGeneratingAvatar(false)
    }
  }

  const STATUS_LABELS: Record<string, string> = {
    queued: 'Venter i kø...',
    tts: 'Genererer tale med ElevenLabs...',
    encoding: 'Koder bildesegmenter...',
    lipsync: 'Genererer avatar-video med VEED Fabric...',
    assembling: 'Setter sammen video...',
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
    if (segments.length > 0) {
      const imageSeg = segments.find(s => s.type === 'image' && !s.imageUrl)
      if (imageSeg) {
        setError(`Segment ${imageSeg.id + 1} er satt til «bilde» men mangler bildevalg.`)
        return
      }
    }

    setGeneratingVideo(true)
    setError('')
    setVideoUrl(null)
    setStatusMsg('Sender til worker...')

    const outroPayload = outro.images.length > 0 ? outro : undefined
    const body = segments.length > 0
      ? { propertyId: id, voiceId: profile.voice_id, avatarImageUrl: selectedAvatarUrl, segments, outro: outroPayload }
      : { propertyId: id, script, voiceId: profile.voice_id, avatarImageUrl: selectedAvatarUrl, propertyImages: selectedVideoImages }

    const res = await fetch('/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" />
        </div>
      )}
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
            <div className="flex gap-2">
              {script && (
                <button
                  onClick={handleSplitSegments}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Del opp i segmenter
                </button>
              )}
              <button
                onClick={handleGenerateScript}
                disabled={generatingScript}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {generatingScript ? 'Genererer...' : script ? 'Regenerer' : 'Generer manus'}
              </button>
            </div>
          </div>
          <textarea
            value={script}
            onChange={e => { setScript(e.target.value); setSegments([]) }}
            placeholder="Trykk «Generer manus» for å lage et AI-generert presentasjonsmanus basert på boligdataene..."
            rows={8}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {script && (
            <p className="text-xs text-gray-400">{script.split(/\s+/).length} ord · ca. {Math.round(script.split(/\s+/).length / 2.5)} sek</p>
          )}
        </div>

        {/* Segment editor */}
        {segments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Segmenter</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {segments.filter(s => s.type === 'avatar').length} avatar · {segments.filter(s => s.type === 'image').length} bilde
                </p>
              </div>
              <button onClick={() => setSegments([])} className="text-xs text-gray-400 hover:text-gray-700">Fjern segmentering</button>
            </div>
            <div className="space-y-3">
              {segments.map((seg, i) => (
                <div key={seg.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 mt-2 w-5 shrink-0">{i + 1}.</span>
                    <textarea
                      value={seg.text}
                      onChange={e => updateSegment(i, { text: e.target.value })}
                      rows={2}
                      className="flex-1 text-sm text-gray-700 leading-relaxed rounded border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                    />
                    <button
                      onClick={() => setSegments(prev => prev.filter((_, j) => j !== i))}
                      title="Fjern segment"
                      className="mt-1.5 text-gray-300 hover:text-red-500 transition-colors text-sm px-1"
                    >✕</button>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <button
                      onClick={() => updateSegment(i, { type: 'avatar', imageUrl: undefined })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${seg.type === 'avatar' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Avatarvideo
                    </button>
                    <button
                      onClick={() => updateSegment(i, { type: 'image' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${seg.type === 'image' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Boligbilde
                    </button>
                    <div className="ml-auto flex gap-1.5">
                      <button
                        onClick={() => handlePlaySegmentAudio(i)}
                        disabled={seg.previewingAudio || !profile.voice_id}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                      >
                        {seg.previewingAudio ? '...' : '▶ Hør lyd'}
                      </button>
                      <button
                        onClick={() => handleRegenSegmentAudio(i)}
                        disabled={seg.previewingAudio || !profile.voice_id}
                        title="Generer ny versjon av lyden"
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                      >
                        ⟳ Regenerer
                      </button>
                    </div>
                  </div>
                  {seg.type === 'image' && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-400">Velg bilde for dette segmentet:</p>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {(property?.images || []).map((img, j) => (
                          <img
                            key={j}
                            src={img}
                            alt=""
                            onClick={() => updateSegment(i, { imageUrl: img })}
                            className={`w-16 h-12 object-cover rounded cursor-pointer flex-shrink-0 border-2 transition-all ${seg.imageUrl === img ? 'border-blue-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`}
                          />
                        ))}
                      </div>
                      {!seg.imageUrl && (
                        <p className="text-xs text-amber-600">Velg et bilde over</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outro editor — only when segments are active */}
        {segments.length > 0 && (() => {
          const usedUrls = new Set(segments.filter(s => s.type === 'image' && s.imageUrl).map(s => s.imageUrl!))
          const unused = (property?.images || []).filter(img => !usedUrls.has(img))
          return (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900">Outro — gjenværende bilder</h2>
                <p className="text-xs text-gray-400 mt-0.5">{unused.length} bilder ikke brukt i segmentene. Velg hvilke som skal vises etter talen med musikk under.</p>
              </div>

              {unused.length > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    {unused.map((img, j) => {
                      const selected = outro.images.includes(img)
                      return (
                        <div
                          key={j}
                          onClick={() => setOutro(o => ({
                            ...o,
                            images: selected ? o.images.filter(u => u !== img) : [...o.images, img],
                          }))}
                          className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selected ? 'border-blue-500 opacity-100' : 'border-transparent opacity-40 hover:opacity-70'}`}
                        >
                          <img src={img} alt="" className="w-20 h-14 object-cover" />
                          {selected && (
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
                  <div className="flex gap-2">
                    <button onClick={() => setOutro(o => ({ ...o, images: unused }))} className="text-xs text-blue-600 hover:underline">Velg alle</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={() => setOutro(o => ({ ...o, images: [] }))} className="text-xs text-gray-400 hover:underline">Fjern alle</button>
                    <span className="text-gray-400 text-xs ml-2">{outro.images.length} valgt</span>
                  </div>
                </div>
              )}

              {outro.images.length > 0 && (
                <div className="space-y-3 border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-600 w-36 shrink-0">Varighet per bilde</label>
                    <input
                      type="range" min={2} max={10} step={1}
                      value={outro.durationPerImage}
                      onChange={e => setOutro(o => ({ ...o, durationPerImage: Number(e.target.value) }))}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-600 w-12 text-right">{outro.durationPerImage} sek</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600">Bakgrunnsmusikk (valgfritt)</label>
                      <label className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${uploadingMusic ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                        {uploadingMusic ? 'Laster opp...' : '+ Last opp MP3'}
                        <input type="file" accept="audio/*" className="hidden" onChange={handleMusicUpload} disabled={uploadingMusic} />
                      </label>
                    </div>

                    {musicFiles.length > 0 && (
                      <div className="space-y-1">
                        {musicFiles.map(f => (
                          <div
                            key={f.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${outro.musicUrl === f.url ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => setOutro(o => ({ ...o, musicUrl: outro.musicUrl === f.url ? '' : f.url }))}
                          >
                            <span className="text-sm">{outro.musicUrl === f.url ? '♪' : '○'}</span>
                            <span className="text-sm text-gray-700 flex-1 truncate">{f.name}</span>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteMusic(f.id, f.url) }}
                              className="text-gray-300 hover:text-red-500 text-xs px-1 transition-colors"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {musicFiles.length === 0 && !uploadingMusic && (
                      <p className="text-xs text-gray-400">Last opp en MP3-fil. Musikken loopes og fades ut på slutten av outtoen.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

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
                    <button
                      onClick={e => { e.stopPropagation(); setLightboxUrl(s.image_url) }}
                      title="Forstørr"
                      className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-black/50 hover:bg-blue-600 flex items-center justify-center text-white text-xs transition-colors"
                    >
                      ⤢
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

              {(selectedAvatarUrl || profile.portrait_url) && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <img
                    src={selectedAvatarUrl || profile.portrait_url}
                    className="w-8 h-10 object-cover rounded border border-gray-200"
                    alt="Kilde"
                  />
                  <span>
                    {selectedAvatarUrl
                      ? 'Bruker valgt bilde — velg et annet over for å bytte'
                      : 'Bruker portrettbilde — velg et setting-bilde over for bedre resultat'}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateAvatar}
                  disabled={generatingAvatar || (!profile.portrait_url && !selectedAvatarUrl)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {generatingAvatar && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {generatingAvatar ? 'Genererer (~20 sek)...' : generatedAvatarUrl ? '↺ Regenerer' : 'Generer foran denne boligen'}
                </button>
                {!profile.portrait_url && !selectedAvatarUrl && (
                  <p className="text-xs text-gray-400">Last opp portrett i profilen din først</p>
                )}
              </div>

              {/* Show generated result + select + save */}
              {generatedAvatarUrl && (
                <div className="flex items-end gap-3">
                  <div
                    onClick={() => setSelectedAvatarUrl(generatedAvatarUrl)}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${selectedAvatarUrl === generatedAvatarUrl ? 'border-blue-500' : 'border-gray-200 opacity-80 hover:opacity-100'}`}
                  >
                    <img src={generatedAvatarUrl} alt="Generert avatar" className="w-48 h-32 object-cover" />
                    <button
                      onClick={e => { e.stopPropagation(); setLightboxUrl(generatedAvatarUrl) }}
                      title="Forstørr"
                      className="absolute bottom-6 right-1 w-6 h-6 rounded-full bg-black/50 hover:bg-blue-600 flex items-center justify-center text-white text-xs transition-colors"
                    >
                      ⤢
                    </button>
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

        {/* Property image picker for video — hidden when segment editor is active */}
        {segments.length === 0 && property.images?.length > 0 && (
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
            disabled={generatingVideo || !script || (segments.length === 0 && selectedVideoImages.length === 0)}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generatingVideo ? 'Genererer video...' : 'Generer presentasjonsvideo'}
          </button>
        </div>

        {/* Video result */}
        {videoUrl && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Ferdig video</h2>
            <video src={videoUrl} controls className="w-full rounded-lg" style={{ aspectRatio: 'auto' }} />
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
