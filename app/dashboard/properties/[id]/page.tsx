'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { TEMPLATE_AVATARS, type TemplateAvatar } from '../../../../lib/template-avatars'

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
  logo_url?: string
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
  const [selectedImageIdx, setSelectedImageIdx] = useState(-1)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [selectedVideoImages, setSelectedVideoImages] = useState<string[]>([])
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [outro, setOutro] = useState<Outro>({ images: [], musicUrl: '', durationPerImage: 4 })
  const [musicFiles, setMusicFiles] = useState<{ id: string; name: string; url: string }[]>([])
  const [uploadingMusic, setUploadingMusic] = useState(false)
  const [noCreditsModal, setNoCreditsModal] = useState(false)
  const [pastVideos, setPastVideos] = useState<{ id: string; video_url: string; created_at: string; collection_ids: string[] }[]>([])
  const [collections, setCollections] = useState<{ id: string; name: string; is_org: boolean }[]>([])
  const [folderPanelVideoId, setFolderPanelVideoId] = useState<string | null>(null)
  const [activeAvatar, setActiveAvatar] = useState<TemplateAvatar | null>(null)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)

  // Publish modal
  type SocialConnection = { id: string; platform: string; page_name: string; token_expires_at: string | null }
  const [publishModalUrl, setPublishModalUrl] = useState<string | null>(null)
  const [publishConnections, setPublishConnections] = useState<SocialConnection[]>([])
  const [publishSelected, setPublishSelected] = useState<Set<string>>(new Set())
  const [publishCaption, setPublishCaption] = useState('')
  const [publishLoading, setPublishLoading] = useState(false)
  const [publishResults, setPublishResults] = useState<{ pageName: string; success: boolean; error?: string }[] | null>(null)

  async function openPublishModal(url: string) {
    setPublishModalUrl(url)
    setPublishResults(null)
    setPublishCaption('')
    setPublishSelected(new Set())
    setPublishLoading(true)
    try {
      const res = await fetch('/api/social/connections')
      if (res.ok) {
        const conns: SocialConnection[] = await res.json()
        setPublishConnections(conns)
        // Pre-select all non-expired connections
        const valid = conns.filter(c => !c.token_expires_at || new Date(c.token_expires_at) > new Date())
        setPublishSelected(new Set(valid.map(c => c.id)))
      }
    } finally {
      setPublishLoading(false)
    }
  }

  async function handlePublish() {
    if (!publishModalUrl || publishSelected.size === 0) return
    setPublishLoading(true)
    setPublishResults(null)
    try {
      const res = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url:      publishModalUrl,
          caption:        publishCaption,
          connection_ids: Array.from(publishSelected),
        }),
      })
      const data = await res.json()
      if (data.results) setPublishResults(data.results)
    } finally {
      setPublishLoading(false)
    }
  }

  // True only if the user has uploaded/generated their own portrait (not a template placeholder)
  const hasOwnAvatar = !!profile.portrait_url &&
    !TEMPLATE_AVATARS.some(av => av.portraitUrl === profile.portrait_url)

  // Effective values — template avatar overrides own profile when selected
  const effectiveVoiceId   = activeAvatar?.voiceId     ?? profile.voice_id    ?? ''
  const effectivePortrait  = activeAvatar?.portraitUrl  ?? profile.portrait_url ?? ''
  const effectiveAgentName = activeAvatar?.name         ?? profile.name         ?? 'megler'
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch(`/api/properties/get?id=${id}`).then(r => r.json()).then((p: Property) => {
      setProperty(p)
      setSelectedVideoImages(p.images || [])
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
    fetch(`/api/properties/videos?propertyId=${id}`).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setPastVideos(d)
    })
    fetch('/api/collections').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setCollections(d)
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
    if (!effectiveVoiceId) { setError('Ingen stemme valgt i profilen'); return null }
    updateSegment(idx, { previewingAudio: true })
    try {
      const res = await fetch('/api/profile/tts-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: segments[idx].text, voiceId: effectiveVoiceId }),
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

  async function playVoiceSample(voiceId: string) {
    if (playingVoiceId === voiceId) return
    setPlayingVoiceId(voiceId)
    try {
      const res = await fetch('/api/profile/tts-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hei, jeg er glad for å presentere denne flotte boligen for deg i dag.', voiceId }),
      })
      if (!res.ok) throw new Error('tts failed')
      const blob = await res.blob()
      const audioUrl = URL.createObjectURL(blob)
      const audio = new Audio(audioUrl)
      audio.onended = () => { setPlayingVoiceId(null); URL.revokeObjectURL(audioUrl) }
      audio.onerror = () => { setPlayingVoiceId(null); URL.revokeObjectURL(audioUrl) }
      await audio.play()
    } catch {
      setPlayingVoiceId(null)
    }
  }

  async function downloadVideo(url: string, filename = 'presentasjon.mp4') {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(url, '_blank')
    }
  }

  async function handleGenerateScript() {
    if (!property) return
    setGeneratingScript(true)
    setError('')
    const res = await fetch('/api/properties/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property, agentProfile: { ...profile, name: effectiveAgentName } }),
    })
    const data = await res.json()
    setGeneratingScript(false)
    if (data.error) setError(data.error)
    else setScript(data.script)
  }

  async function handleGenerateAvatar() {
    if (!effectivePortrait) { setError('Last opp et portrettbilde i profilen din først'); return }
    if (!property?.images?.length) { setError('Ingen boligbilder tilgjengelig'); return }
    const propertyImg = property.images[selectedImageIdx]
    setGeneratingAvatar(true)
    setAvatarSaved(false)
    setError('')
    try {
      const agentSourceUrl = selectedAvatarUrl || effectivePortrait
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
          if (data.videoUrl) {
            // Re-fetch from DB to avoid duplicates (video already saved server-side)
            fetch(`/api/properties/videos?propertyId=${id}`)
              .then(r => r.json())
              .then(d => { if (Array.isArray(d)) setPastVideos(d) })
          }
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
    if (!script || !effectiveVoiceId) {
      setError('Mangler manus eller stemme-ID i profilen')
      return
    }
    if (!selectedAvatarUrl && !effectivePortrait) {
      setError('Last opp et portrettbilde i profilen din for å generere video')
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

    const tickerParts = [
      property?.address,
      property?.price ? `Prisantydning: ${formatPrice(property.price)}` : null,
      property?.size_bra ? `BRA: ${property.size_bra} m²` : null,
      property?.rooms ? `${property.rooms} rom` : null,
      property?.build_year ? `Byggeår: ${property.build_year}` : null,
      property?.property_type ?? null,
    ].filter(Boolean)
    const tickerText = outro.images.length > 0
      ? (tickerParts.length > 0 ? tickerParts.join('  ·  ') : property?.title || property?.address || 'Se mer om denne boligen')
      : undefined
    const logoUrl = profile.logo_url || undefined
    const outroPayload = (outro.images.length > 0 || logoUrl)
      ? { ...outro, tickerText, ...(logoUrl ? { logoUrl } : {}) }
      : undefined

    // Prepend a 1.5s still shot of the property's first image before avatar speaks
    const introSegment = (segments.length > 0 && property?.images?.[0])
      ? [{ type: 'still' as const, imageUrl: property.images[0], duration: 1.5 }]
      : []
    const segmentsWithIntro = [...introSegment, ...segments]

    const body = segments.length > 0
      ? { propertyId: id, voiceId: effectiveVoiceId, avatarImageUrl: selectedAvatarUrl || effectivePortrait, portraitUrl: effectivePortrait, backgroundImageUrl: selectedAvatarUrl ? property?.images?.[selectedImageIdx] : undefined, segments: segmentsWithIntro, outro: outroPayload }
      : { propertyId: id, script, voiceId: effectiveVoiceId, avatarImageUrl: selectedAvatarUrl, propertyImages: selectedVideoImages }

    const res = await fetch('/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (res.status === 402 && data.code === 'NO_CREDITS') {
      setGeneratingVideo(false)
      setStatusMsg('')
      setNoCreditsModal(true)
      return
    }
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

  if (!property) {
    return (
      <div className="p-8 text-sm" style={{ color: 'var(--muted)' }}>Laster...</div>
    )
  }

  const thumbBorder = (active: boolean) => ({
    border: `2px solid ${active ? 'var(--gold)' : 'transparent'}`,
    opacity: active ? 1 : 0.6,
  })

  return (
    <div className="p-6">
      {/* No credits modal */}
      {noCreditsModal && (
        <div className="app-modal-backdrop">
          <div className="app-modal">
            <div className="text-4xl mb-3">🎬</div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
              Ingen videokreditter igjen
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
              Du har brukt opp alle inkluderte videoer denne måneden. Kredittene nullstilles 1. i neste måned.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="/dashboard/billing#extra-credits"
                className="app-btn-primary block w-full text-center"
                style={{ textDecoration: 'none' }}
              >
                Kjøp enkeltvideoer
              </a>
              <a
                href="/dashboard/billing"
                className="app-btn-secondary block w-full text-center"
                style={{ textDecoration: 'none' }}
              >
                Se fakturering
              </a>
              <button onClick={() => setNoCreditsModal(false)} className="app-btn-ghost w-full text-sm">
                Lukk
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-xl object-contain" style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }} />
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="app-btn-ghost text-sm px-0">← Tilbake</button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
              {property.title || property.address}
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{property.address}</p>
          </div>
        </div>

        {/* Image gallery */}
        {property.images?.length > 0 && (
          <div className="space-y-2">
            <img src={property.images[selectedImageIdx >= 0 ? selectedImageIdx : 0]} alt="" className="w-full h-64 object-cover rounded-xl" />
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ overscrollBehaviorX: 'contain' }}>
              {property.images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt=""
                  onClick={() => setSelectedImageIdx(i)}
                  className="w-16 h-12 object-cover rounded cursor-pointer flex-shrink-0 transition-all"
                  style={thumbBorder(i === selectedImageIdx)}
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
            <div
              key={f.label}
              className="rounded-lg p-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{f.label}</p>
              <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{String(f.value)}</p>
            </div>
          ))}
        </div>

        {/* Facilities */}
        {property.facilities?.length ? (
          <div className="flex flex-wrap gap-2">
            {property.facilities.map(f => (
              <span key={f} className="app-badge-muted">{f}</span>
            ))}
          </div>
        ) : null}

        {/* ── Presenter + bakgrunn (unified) ── */}
        <div className="app-card" style={{ padding: '16px 20px' }}>
          <h2 className="font-semibold" style={{ color: 'var(--ink)', marginBottom: '14px', fontSize: '15px' }}>
            Velg presenter og bakgrunn
          </h2>

          {/* — Presenter row — */}
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', overscrollBehaviorX: 'contain' }}>
            {hasOwnAvatar ? (
              <button
                onClick={() => { setActiveAvatar(null); setSelectedAvatarUrl(''); setGeneratedAvatarUrl(null) }}
                style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  background: activeAvatar === null ? 'var(--blue-soft)' : 'var(--surface-2)',
                  border: `2px solid ${activeAvatar === null ? 'var(--blue)' : 'var(--line)'}`,
                  borderRadius: '12px', padding: '10px 14px', cursor: 'pointer', minWidth: '80px',
                }}
              >
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', background: 'var(--line)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.portrait_url} alt="Din avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: activeAvatar === null ? 'var(--blue)' : 'var(--ink)' }}>Din avatar</span>
                {profile.name && <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{profile.name.split(' ')[0]}</span>}
                {profile.voice_id && (
                  <button onClick={e => { e.stopPropagation(); playVoiceSample(profile.voice_id!) }}
                    style={{ fontSize: '10px', color: playingVoiceId === profile.voice_id ? 'var(--blue)' : 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', marginTop: '2px' }}>
                    {playingVoiceId === profile.voice_id ? '■ Spiller...' : '▶ Hør'}
                  </button>
                )}
              </button>
            ) : (
              <a href="/dashboard/profile" style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                background: 'var(--surface-2)', border: '2px dashed var(--line)',
                borderRadius: '12px', padding: '10px 14px', cursor: 'pointer', minWidth: '80px', textDecoration: 'none',
              }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '22px' }}>＋</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--blue)', textAlign: 'center', lineHeight: 1.3 }}>Lag din<br />avatar →</span>
              </a>
            )}

            <div style={{ width: '1px', background: 'var(--line)', margin: '4px 0', flexShrink: 0 }} />

            {TEMPLATE_AVATARS.map(av => (
              <button key={av.id}
                onClick={() => { setActiveAvatar(av); setSelectedAvatarUrl(''); setGeneratedAvatarUrl(null) }}
                style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  background: activeAvatar?.id === av.id ? 'var(--blue-soft)' : 'var(--surface-2)',
                  border: `2px solid ${activeAvatar?.id === av.id ? 'var(--blue)' : 'var(--line)'}`,
                  borderRadius: '12px', padding: '10px 14px', cursor: 'pointer', minWidth: '80px',
                }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={av.portraitUrl} alt={av.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: activeAvatar?.id === av.id ? 'var(--blue)' : 'var(--ink)' }}>{av.name}</span>
                <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{av.desc}</span>
                <button onClick={e => { e.stopPropagation(); playVoiceSample(av.voiceId) }}
                  style={{ fontSize: '10px', color: playingVoiceId === av.voiceId ? 'var(--blue)' : 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', marginTop: '2px' }}>
                  {playingVoiceId === av.voiceId ? '■ Spiller...' : '▶ Hør'}
                </button>
              </button>
            ))}
          </div>

          {/* — Bakgrunn row — always visible once an avatar is active or images exist — */}
          {(activeAvatar || hasOwnAvatar || property.images?.length > 0) && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>

              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', alignItems: 'center', overscrollBehaviorX: 'contain' }}>

                {/* Portrett — always first, default choice */}
                <div onClick={() => setSelectedAvatarUrl('')}
                  style={{
                    flexShrink: 0, cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', position: 'relative',
                    border: `2px solid ${selectedAvatarUrl === '' ? 'var(--gold)' : 'var(--line)'}`,
                    transition: 'border-color 0.15s',
                  }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(activeAvatar ? activeAvatar.portraitUrl : profile.portrait_url) ?? ''}
                    alt="Portrett"
                    style={{ width: '104px', height: '88px', objectFit: 'cover', objectPosition: 'center 10%', display: 'block' }}
                  />
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: selectedAvatarUrl === '' ? 'var(--gold)' : 'rgba(11,11,12,0.55)',
                    color: '#fff', fontSize: '10px', fontWeight: 600, textAlign: 'center', padding: '4px 0',
                  }}>
                    {selectedAvatarUrl === '' ? '✓ Portrett' : 'Portrett'}
                  </div>
                </div>

                {/* Preset setting images (template avatar) */}
                {activeAvatar && activeAvatar.presets.map(preset => (
                  <div key={preset.key}
                    onClick={() => setSelectedAvatarUrl(selectedAvatarUrl === preset.url ? '' : preset.url)}
                    style={{
                      flexShrink: 0, cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', position: 'relative',
                      border: `2px solid ${selectedAvatarUrl === preset.url ? 'var(--gold)' : 'transparent'}`,
                      opacity: selectedAvatarUrl === preset.url ? 1 : 0.6,
                      transition: 'opacity 0.15s, border-color 0.15s',
                    }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preset.url} alt={preset.label} style={{ width: '140px', height: '88px', objectFit: 'cover', display: 'block' }} />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: selectedAvatarUrl === preset.url ? 'var(--gold)' : 'rgba(11,11,12,0.55)',
                      color: '#fff', fontSize: '10px', fontWeight: 600, textAlign: 'center', padding: '4px 0',
                    }}>
                      {selectedAvatarUrl === preset.url ? `✓ ${preset.label}` : preset.label}
                    </div>
                  </div>
                ))}

                {/* User own setting images */}
                {!activeAvatar && settingImages.map(s => (
                  <div key={s.image_url}
                    onClick={() => setSelectedAvatarUrl(selectedAvatarUrl === s.image_url ? '' : s.image_url)}
                    className="relative flex-shrink-0"
                    style={{
                      borderRadius: '8px', overflow: 'hidden', cursor: 'pointer',
                      border: `2px solid ${selectedAvatarUrl === s.image_url ? 'var(--gold)' : 'transparent'}`,
                      opacity: selectedAvatarUrl === s.image_url ? 1 : 0.6,
                      transition: 'opacity 0.15s, border-color 0.15s',
                    }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.image_url} alt={s.setting_type} style={{ width: '140px', height: '88px', objectFit: 'cover', display: 'block' }} />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: selectedAvatarUrl === s.image_url ? 'var(--gold)' : 'rgba(11,11,12,0.55)',
                      color: '#fff', fontSize: '10px', fontWeight: 600, textAlign: 'center', padding: '4px 0',
                    }}>
                      {selectedAvatarUrl === s.image_url ? '✓ ' : ''}{s.setting_type.replace(/_/g, ' ')}
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDeleteSettingImage(s) }}
                      title="Slett" className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                      style={{ background: 'rgba(13,11,8,0.6)', color: '#fff' }}>✕</button>
                  </div>
                ))}

                {/* Generated composite — appears in row after generation */}
                {generatedAvatarUrl && (
                  <div onClick={() => setSelectedAvatarUrl(selectedAvatarUrl === generatedAvatarUrl ? '' : generatedAvatarUrl)}
                    style={{
                      flexShrink: 0, cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', position: 'relative',
                      border: `2px solid ${selectedAvatarUrl === generatedAvatarUrl ? 'var(--gold)' : 'var(--line)'}`,
                      transition: 'border-color 0.15s',
                    }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={generatedAvatarUrl} alt="Generert" style={{ width: '104px', height: '88px', objectFit: 'cover', display: 'block' }} />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: selectedAvatarUrl === generatedAvatarUrl ? 'var(--gold)' : 'rgba(11,11,12,0.55)',
                      color: '#fff', fontSize: '10px', fontWeight: 600, textAlign: 'center', padding: '4px 0',
                    }}>
                      {selectedAvatarUrl === generatedAvatarUrl ? '✓ Generert' : 'Generert'}
                    </div>
                  </div>
                )}

                {/* Separator + property images for composite generation */}
                {property.images?.length > 0 && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, padding: '0 6px', gap: '3px' }}>
                      <div style={{ width: '1px', height: '22px', background: 'var(--line)' }} />
                      <span
                        title="Vil du at presenteren skal stå foran et bilde fra denne boligen? Velg et bilde her og klikk «Generer» — AI-en setter presenteren inn i bildet."
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '16px', height: '16px', borderRadius: '50%',
                          border: '1px solid var(--line-2)', background: 'var(--surface-2)',
                          fontSize: '10px', color: 'var(--muted)', cursor: 'default',
                          fontFamily: 'var(--sans)', fontWeight: 600, flexShrink: 0,
                          userSelect: 'none',
                        }}
                      >?</span>
                      <div style={{ width: '1px', height: '22px', background: 'var(--line)' }} />
                    </div>
                    {property.images.map((img, i) => (
                      <div key={i}
                        onClick={() => setSelectedImageIdx(i === selectedImageIdx ? -1 : i)}
                        style={{
                          flexShrink: 0, cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', position: 'relative',
                          border: `2px solid ${selectedImageIdx === i ? 'var(--blue)' : 'transparent'}`,
                          opacity: selectedImageIdx === i ? 1 : 0.55,
                          transition: 'opacity 0.15s, border-color 0.15s',
                        }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" style={{ width: '104px', height: '88px', objectFit: 'cover', display: 'block' }} />
                        {selectedImageIdx === i && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--blue)', color: '#fff', fontSize: '10px', fontWeight: 600, textAlign: 'center', padding: '4px 0' }}>
                            Valgt
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Generate button — only when a property image is selected */}
              {selectedImageIdx >= 0 && property.images?.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={handleGenerateAvatar}
                    disabled={generatingAvatar || (!effectivePortrait && !selectedAvatarUrl)}
                    className="app-btn-primary flex items-center gap-2"
                    style={{ padding: '8px 14px', fontSize: '13px' }}>
                    {generatingAvatar && (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {generatingAvatar ? 'Genererer (~20 sek)...' : generatedAvatarUrl ? '↺ Regenerer foran valgt bilde' : 'Generer foran valgt bilde'}
                  </button>
                  {generatedAvatarUrl && (
                    <button onClick={handleSaveAvatar} disabled={savingAvatar} className="app-btn-secondary text-xs" style={{ padding: '6px 12px' }}>
                      {savingAvatar ? 'Lagrer...' : avatarSaved ? '✓ Lagret' : 'Lagre til bibliotek'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Script section */}
        <div className="app-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: 'var(--ink)' }}>Presentasjonsmanus</h2>
            <div className="flex gap-2">
              {script && (
                <button onClick={handleSplitSegments} className="app-btn-secondary text-sm">
                  Del opp i segmenter
                </button>
              )}
              <button
                onClick={handleGenerateScript}
                disabled={generatingScript}
                className="app-btn-primary text-sm"
                style={{ padding: '8px 16px' }}
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
            className="app-textarea"
          />
          {script && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {script.split(/\s+/).length} ord · ca. {Math.round(script.split(/\s+/).length / 2.5)} sek
            </p>
          )}
        </div>

        {/* Segment editor */}
        {segments.length > 0 && (
          <div className="app-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold" style={{ color: 'var(--ink)' }}>Segmenter</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {segments.filter(s => s.type === 'avatar').length} avatar · {segments.filter(s => s.type === 'image').length} bilde
                </p>
              </div>
              <button onClick={() => setSegments([])} className="app-btn-ghost text-xs">Fjern segmentering</button>
            </div>
            <div className="space-y-3">
              {segments.map((seg, i) => (
                <div
                  key={seg.id}
                  className="rounded-lg p-4 space-y-3"
                  style={{ border: '1px solid var(--line)', background: 'var(--surface-2)' }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs mt-2 w-5 shrink-0" style={{ color: 'var(--muted)' }}>{i + 1}.</span>
                    <textarea
                      value={seg.text}
                      onChange={e => updateSegment(i, { text: e.target.value })}
                      rows={2}
                      className="app-textarea flex-1"
                      style={{ fontSize: '13px' }}
                    />
                    <button
                      onClick={() => setSegments(prev => prev.filter((_, j) => j !== i))}
                      title="Fjern segment"
                      className="mt-1.5 app-btn-ghost text-sm px-1"
                    >✕</button>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <button
                      onClick={() => updateSegment(i, { type: 'avatar', imageUrl: undefined })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: seg.type === 'avatar' ? 'var(--gold)' : 'var(--surface)',
                        color: seg.type === 'avatar' ? '#fff' : 'var(--muted)',
                        border: `1px solid ${seg.type === 'avatar' ? 'var(--gold)' : 'var(--line)'}`,
                      }}
                    >
                      Avatarvideo
                    </button>
                    <button
                      onClick={() => updateSegment(i, { type: 'image' })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: seg.type === 'image' ? 'var(--gold)' : 'var(--surface)',
                        color: seg.type === 'image' ? '#fff' : 'var(--muted)',
                        border: `1px solid ${seg.type === 'image' ? 'var(--gold)' : 'var(--line)'}`,
                      }}
                    >
                      Boligbilde
                    </button>
                    <div className="ml-auto flex gap-1.5">
                      <button
                        onClick={() => handlePlaySegmentAudio(i)}
                        disabled={seg.previewingAudio || !effectiveVoiceId}
                        className="app-btn-secondary text-xs"
                        style={{ padding: '6px 12px' }}
                      >
                        {seg.previewingAudio ? '...' : '▶ Hør lyd'}
                      </button>
                      <button
                        onClick={() => handleRegenSegmentAudio(i)}
                        disabled={seg.previewingAudio || !effectiveVoiceId}
                        title="Generer ny versjon av lyden"
                        className="app-btn-secondary text-xs"
                        style={{ padding: '6px 12px' }}
                      >
                        ⟳ Regenerer
                      </button>
                    </div>
                  </div>
                  {seg.type === 'image' && (
                    <div className="space-y-1.5">
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>Velg bilde for dette segmentet:</p>
                      <div className="flex gap-2 overflow-x-auto pb-1" style={{ overscrollBehaviorX: 'contain' }}>
                        {(property?.images || []).map((img, j) => (
                          <div key={j} className="relative flex-shrink-0 group">
                            <img
                              src={img}
                              alt=""
                              onClick={() => updateSegment(i, { imageUrl: img })}
                              className="w-36 h-24 object-cover rounded-lg cursor-pointer transition-all"
                              style={{
                                border: `2px solid ${seg.imageUrl === img ? 'var(--gold)' : 'transparent'}`,
                                opacity: seg.imageUrl === img ? 1 : 0.5,
                              }}
                            />
                            <button
                              onClick={e => { e.stopPropagation(); setLightboxUrl(img) }}
                              className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity text-[9px]"
                              style={{ background: 'rgba(13,11,8,0.7)' }}
                            >⤢</button>
                          </div>
                        ))}
                      </div>
                      {!seg.imageUrl && (
                        <p className="text-xs" style={{ color: 'var(--gold-deep)' }}>Velg et bilde over</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outro editor */}
        {segments.length > 0 && (() => {
          const usedUrls = new Set(segments.filter(s => s.type === 'image' && s.imageUrl).map(s => s.imageUrl!))
          const unused = (property?.images || []).filter(img => !usedUrls.has(img))
          return (
            <div className="app-card space-y-4">
              <div>
                <h2 className="font-semibold" style={{ color: 'var(--ink)' }}>Outro — gjenværende bilder</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {unused.length} bilder ikke brukt i segmentene. Velg hvilke som skal vises etter talen med musikk under.
                </p>
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
                          className="relative cursor-pointer rounded-lg overflow-hidden group"
                          style={{
                            border: `2px solid ${selected ? 'var(--gold)' : 'transparent'}`,
                            opacity: selected ? 1 : 0.4,
                          }}
                        >
                          <img src={img} alt="" className="w-36 h-24 object-cover" />
                          {selected && (
                            <div
                              className="absolute top-1 right-1 rounded-full w-4 h-4 flex items-center justify-center"
                              style={{ background: 'var(--gold)' }}
                            >
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); setLightboxUrl(img) }}
                            className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity text-[9px]"
                            style={{ background: 'rgba(13,11,8,0.7)' }}
                          >⤢</button>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setOutro(o => ({ ...o, images: unused }))} className="text-xs" style={{ color: 'var(--gold)' }}>Velg alle</button>
                    <span style={{ color: 'var(--line-2)' }}>|</span>
                    <button onClick={() => setOutro(o => ({ ...o, images: [] }))} className="app-btn-ghost text-xs px-0">Fjern alle</button>
                    <span className="text-xs ml-2" style={{ color: 'var(--muted)' }}>{outro.images.length} valgt</span>
                  </div>
                </div>
              )}

              {outro.images.length > 0 && (
                <div className="flex items-center gap-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
                  <label className="text-xs w-36 shrink-0" style={{ color: 'var(--ink-2)' }}>Varighet per bilde</label>
                  <input
                    type="range" min={2} max={10} step={1}
                    value={outro.durationPerImage}
                    onChange={e => setOutro(o => ({ ...o, durationPerImage: Number(e.target.value) }))}
                    className="flex-1"
                  />
                  <span className="text-xs w-12 text-right" style={{ color: 'var(--ink-2)' }}>{outro.durationPerImage} sek</span>
                </div>
              )}

              {/* Musikk */}
              <div className="space-y-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
                <div className="flex items-center justify-between">
                  <label className="text-xs" style={{ color: 'var(--muted)' }}>Bakgrunnsmusikk (valgfritt)</label>
                  <label className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${uploadingMusic ? 'opacity-40' : ''} app-btn-secondary`}>
                    {uploadingMusic ? 'Laster opp...' : '+ Last opp MP3'}
                    <input type="file" accept="audio/*" className="hidden" onChange={handleMusicUpload} disabled={uploadingMusic} />
                  </label>
                </div>

                {musicFiles.length > 0 && (
                  <div className="space-y-1">
                    {musicFiles.map(f => (
                      <div
                        key={f.id}
                        className={`app-music-row${outro.musicUrl === f.url ? ' active' : ''}`}
                        onClick={() => setOutro(o => ({ ...o, musicUrl: outro.musicUrl === f.url ? '' : f.url }))}
                      >
                        <span className="text-sm">{outro.musicUrl === f.url ? '♪' : '○'}</span>
                        <span className="text-sm flex-1 truncate">{f.name}</span>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteMusic(f.id, f.url) }}
                          className="app-btn-ghost text-xs px-1"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {musicFiles.length === 0 && !uploadingMusic && (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Ingen musikk lastet opp ennå. Last opp en MP3 — den loopes og fades ut.</p>
                )}
              </div>
            </div>
          )
        })()}


        {/* Property image picker for video */}
        {segments.length === 0 && property.images?.length > 0 && (
          <div className="app-card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold" style={{ color: 'var(--ink)' }}>Velg bilder til video</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {selectedVideoImages.length} av {property.images.length} valgt · Klikk for å velge/fjerne
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedVideoImages(property.images)} className="text-xs" style={{ color: 'var(--gold)' }}>
                  Velg alle
                </button>
                <span style={{ color: 'var(--line-2)' }}>|</span>
                <button onClick={() => setSelectedVideoImages([])} className="app-btn-ghost text-xs px-0">
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
                    className="relative cursor-pointer rounded-lg overflow-hidden"
                    style={{
                      border: `2px solid ${isSelected ? 'var(--gold)' : 'transparent'}`,
                      opacity: isSelected ? 1 : 0.4,
                    }}
                  >
                    <img src={img} alt="" className="w-36 h-24 object-cover" />
                    {isSelected && (
                      <div
                        className="absolute top-1 right-1 rounded-full w-4 h-4 flex items-center justify-center"
                        style={{ background: 'var(--gold)' }}
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3}>
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
          {error && <div className="app-error">{error}</div>}
          {generatingVideo && (
            <div className="space-y-2">
              <div className="app-info">
                <svg className="animate-spin h-4 w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>{statusMsg || 'Jobber...'}</span>
              </div>
            </div>
          )}
          {!generatingVideo && statusMsg && (
            <div className="app-info">{statusMsg}</div>
          )}
          <button
            onClick={handleGenerateVideo}
            disabled={generatingVideo || !script || (segments.length === 0 && selectedVideoImages.length === 0)}
            className="app-btn-primary w-full"
            style={{ padding: '14px', fontSize: '15px', borderRadius: '12px' }}
          >
            {generatingVideo ? 'Genererer video...' : 'Generer presentasjonsvideo'}
          </button>
        </div>

        {/* Video result */}
        {videoUrl && (
          <div className="app-card space-y-4" style={{ border: '1px solid var(--gold-deep)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--ink)' }}>Ferdig video ✓</h2>
            <video src={videoUrl} controls className="w-full rounded-lg" style={{ aspectRatio: 'auto' }} />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => downloadVideo(videoUrl)}
                className="app-btn-primary"
                style={{ fontSize: '13px', padding: '8px 18px' }}
              >
                ⬇ Last ned video
              </button>
              <button
                onClick={() => openPublishModal(videoUrl)}
                className="app-btn-secondary"
                style={{ fontSize: '13px', padding: '8px 18px' }}
              >
                📤 Publiser
              </button>
              <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Legg den i en mappe nedenfor for å arkivere den.
              </p>
            </div>
          </div>
        )}

        {/* Videohistorikk — bare videoer som ikke er lagt i mappe */}
        {(() => {
          const unfiledVideos = pastVideos.filter(v => v.collection_ids.length === 0 && v.video_url !== videoUrl)
          if (unfiledVideos.length === 0) return null
          return (
          <div className="app-card space-y-3">
            <h2 className="font-semibold" style={{ color: 'var(--ink)' }}>
              Tidligere videoer
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted)' }}>{unfiledVideos.length} stk</span>
            </h2>
            <div className="space-y-4">
              {unfiledVideos.map((v, i) => (
                <div key={v.id} className="space-y-1.5">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      #{pastVideos.length - i} —{' '}
                      {new Date(v.created_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                      {/* Folder button */}
                      <button
                        onClick={() => setFolderPanelVideoId(folderPanelVideoId === v.id ? null : v.id)}
                        style={{ fontSize: '11px', color: v.collection_ids.length ? 'var(--blue)' : 'var(--muted)', background: 'none', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        📁 {v.collection_ids.length > 0 ? `${v.collection_ids.length} mappe${v.collection_ids.length > 1 ? 'r' : ''}` : 'Legg i mappe'}
                      </button>

                      {/* Folder panel */}
                      {folderPanelVideoId === v.id && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', zIndex: 50, minWidth: '220px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Velg mapper</p>
                          {collections.length === 0 && (
                            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>Ingen mapper ennå</p>
                          )}
                          {collections.map(c => {
                            const checked = v.collection_ids.includes(c.id)
                            return (
                              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', cursor: 'pointer', fontSize: '13px', color: 'var(--ink)' }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={async () => {
                                    await fetch('/api/collections/assign', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ videoId: v.id, collectionId: c.id, add: !checked }),
                                    })
                                    setPastVideos(prev => prev.map(x => x.id !== v.id ? x : {
                                      ...x,
                                      collection_ids: checked
                                        ? x.collection_ids.filter(id => id !== c.id)
                                        : [...x.collection_ids, c.id],
                                    }))
                                  }}
                                />
                                {c.is_org ? '🏢' : '📁'} {c.name}
                              </label>
                            )
                          })}
                          <button
                            onClick={async () => {
                              const name = prompt('Navn på ny mappe:')?.trim()
                              if (!name) return
                              const res = await fetch('/api/collections', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name }),
                              })
                              const newCol = await res.json()
                              if (!newCol.id) return
                              setCollections(prev => [...prev, { id: newCol.id, name: newCol.name, is_org: false }])
                              await fetch('/api/collections/assign', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ videoId: v.id, collectionId: newCol.id, add: true }),
                              })
                              setPastVideos(prev => prev.map(x => x.id !== v.id ? x : { ...x, collection_ids: [...x.collection_ids, newCol.id] }))
                            }}
                            style={{ marginTop: '8px', width: '100%', fontSize: '12px', color: 'var(--blue)', background: 'none', border: '1px dashed var(--line)', borderRadius: '6px', padding: '5px', cursor: 'pointer' }}
                          >
                            + Ny mappe
                          </button>
                        </div>
                      )}
                      <button
                        onClick={async () => {
                          if (!confirm('Slette denne videoen?')) return
                          await fetch('/api/properties/videos', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ videoId: v.id }),
                          })
                          setPastVideos(prev => prev.filter(x => x.id !== v.id))
                        }}
                        style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                      >
                        Slett
                      </button>
                    </div>
                  </div>
                  <video src={v.video_url} controls className="w-full rounded-lg" style={{ aspectRatio: 'auto' }} />
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button onClick={() => downloadVideo(v.video_url)} className="text-sm" style={{ color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      ⬇ Last ned
                    </button>
                    <button onClick={() => openPublishModal(v.video_url)} className="text-sm" style={{ color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      📤 Publiser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )
        })()}

      </div>

    {/* ─── Publish modal ─── */}
    {publishModalUrl && (
      <div
        onClick={e => { if (e.target === e.currentTarget) setPublishModalUrl(null) }}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '16px',
        }}
      >
        <div style={{
          background: 'var(--surface)', borderRadius: '16px', padding: '28px',
          width: '100%', maxWidth: '480px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
              Publiser video
            </h2>
            <button
              onClick={() => setPublishModalUrl(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--muted)', lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          {/* Results view */}
          {publishResults ? (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {publishResults.map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', borderRadius: '8px',
                    background: r.success ? '#dcfce7' : '#fee2e2',
                    border: `1px solid ${r.success ? '#86efac' : '#fca5a5'}`,
                  }}>
                    <span style={{ fontSize: '16px' }}>{r.success ? '✓' : '✗'}</span>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 500, color: r.success ? '#166534' : '#991b1b', margin: 0 }}>
                        {r.pageName}
                      </p>
                      {!r.success && r.error && (
                        <p style={{ fontSize: '12px', color: '#991b1b', margin: 0 }}>{r.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setPublishModalUrl(null)}
                className="app-btn-primary w-full"
                style={{ padding: '12px' }}
              >
                Lukk
              </button>
            </div>
          ) : publishLoading && publishConnections.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
              Laster tilkoblinger…
            </p>
          ) : publishConnections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '16px' }}>
                Ingen sosiale medier koblet til ennå.
              </p>
              <a
                href="/dashboard/settings/social"
                className="app-btn-secondary"
                style={{ fontSize: '13px', textDecoration: 'none' }}
              >
                Gå til innstillinger →
              </a>
            </div>
          ) : (
            <>
              {/* Account checkboxes */}
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Publiser til
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {publishConnections.map(conn => {
                  const expired = conn.token_expires_at ? new Date(conn.token_expires_at) < new Date() : false
                  const checked = publishSelected.has(conn.id)
                  return (
                    <label
                      key={conn.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 14px', borderRadius: '8px',
                        background: 'var(--surface-2)', border: `1px solid ${expired ? '#f87171' : 'var(--line)'}`,
                        cursor: expired ? 'not-allowed' : 'pointer', opacity: expired ? 0.6 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={expired}
                        onChange={() => {
                          setPublishSelected(prev => {
                            const next = new Set(prev)
                            if (next.has(conn.id)) next.delete(conn.id)
                            else next.add(conn.id)
                            return next
                          })
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', margin: 0 }}>
                          {conn.page_name}
                        </p>
                        <p style={{ fontSize: '11px', color: expired ? '#ef4444' : 'var(--muted)', margin: 0 }}>
                          {conn.platform === 'facebook' ? 'Facebook' : 'LinkedIn'}
                          {expired ? ' · Token utløpt' : ''}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>

              {/* Caption */}
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Tekst / bildetekst
              </p>
              <textarea
                value={publishCaption}
                onChange={e => setPublishCaption(e.target.value)}
                placeholder="Skriv en bildetekst til posten… (valgfritt)"
                rows={3}
                style={{
                  width: '100%', borderRadius: '8px', border: '1px solid var(--line)',
                  padding: '10px 12px', fontSize: '14px', color: 'var(--ink)',
                  background: 'var(--surface-2)', resize: 'vertical',
                  boxSizing: 'border-box', marginBottom: '20px',
                  fontFamily: 'inherit',
                }}
              />

              <button
                onClick={handlePublish}
                disabled={publishLoading || publishSelected.size === 0}
                className="app-btn-primary w-full"
                style={{ padding: '12px', fontSize: '15px' }}
              >
                {publishLoading ? 'Publiserer…' : `Publiser nå (${publishSelected.size})`}
              </button>
            </>
          )}
        </div>
      </div>
    )}
  </div>
  )
}
