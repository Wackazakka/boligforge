'use client'

import { useEffect, useRef, useState } from 'react'
import AccountTabs from './AccountTabs'
const SETTING_PROMPTS: Record<string, string> = {
  modern_home: 'A professional Norwegian real estate agent standing outdoors in front of a beautiful modern Norwegian home. White render walls, large black-frame windows, lush green garden, warm golden-hour sunlight. The agent looks confident and natural, wearing business casual attire. Editorial real estate photography, shallow depth of field.',
  office: 'A professional Norwegian real estate agent standing in a bright Scandinavian open-plan office. Light wood surfaces, tall windows with soft daylight, subtle greenery in the background. The agent looks approachable and confident. Clean editorial photography look.',
  studio: 'A professional Norwegian real estate agent against a smooth warm-neutral gradient studio backdrop. Soft, even professional lighting from the side. Confident, natural expression. High-end professional headshot, sharp focus on face.',
  neighborhood: 'A professional Norwegian real estate agent standing outdoors on a sunny Norwegian residential street. Traditional wooden houses painted in muted colors, leafy trees, clear blue sky, golden afternoon light. The agent looks relaxed and confident. Editorial lifestyle photography.',
}

const VOICES = [
  { id: 'nhvaqgRyAq6BmFs3WcdX', name: 'Øyvind – Dyp og rolig', preview: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/7dc5c03caf8f40daa575fa9eacbf3de8/voices/nhvaqgRyAq6BmFs3WcdX/Z8yVliHOyn9eSmt4YEVw.mp3' },
  { id: 's2xtA7B2CTXPPlJzch1v', name: 'Dennis – Klar og behagelig', preview: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/15af1c0d0dcd479cb8376a767ab07b4c/voices/s2xtA7B2CTXPPlJzch1v/YB9DE4weRg6BTei8hVZ5.mp3' },
  { id: '2dhHLsmg0MVma2t041qT', name: 'Johannes – Selvsikker', preview: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/2dhHLsmg0MVma2t041qT/fX3l7ljt7bx6zRPz8VdC.mp3' },
  { id: 'BGEU6wFi2uNm6Kje1Yhk', name: 'Maja – Nordisk, dramatisk', preview: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/ed9b05e6324c457685490352e9a1ec90/voices/BGEU6wFi2uNm6Kje1Yhk/gCIHS9pPkrtwiAjN4VgG.mp3' },
  { id: 'CMbvLbbccSd611KtwxV3', name: 'Robert – Oslo', preview: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/2461cf568dc042a3bbfbf75522203b35/voices/CMbvLbbccSd611KtwxV3/fabf86a6-90db-42c2-9993-47fff3f73a80.mp3' },
  { id: 'vUmLiNBm6MDcy1NUHaVr', name: 'Helge', preview: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/3690d7df74c84d8880e0e0d0641de7f2/voices/vUmLiNBm6MDcy1NUHaVr/6JBvRVvXcssLtXlaqLg1.mp3' },
  { id: 'uNsWM1StCcpydKYOjKyu', name: 'Mia – Norsk kvinne', preview: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/a2175a4ce5a74c88868dd9d4a000c9a6/voices/uNsWM1StCcpydKYOjKyu/868f87d5-7724-4786-a7fa-a48e01b2ba54.mp3' },
]

const SETTINGS = [
  { id: 'modern_home', label: 'Foran en moderne bolig' },
  { id: 'office', label: 'I et lyst kontor' },
  { id: 'studio', label: 'Nøytral studio' },
  { id: 'neighborhood', label: 'Utendørs i boligfelt' },
]

// Tone-instruks for manus-generering (brukes når stilen «Nøytral» er valgt).
// Verdien lagres som tekst i agent_profiles.tone_of_voice — første preset matcher
// onboarding-defaulten, så eksisterende meglere får riktig valg markert.
const TONE_PRESETS = [
  { label: 'Varm og profesjonell', value: 'Varm og profesjonell. Snakker klart og tydelig om boligens fordeler.' },
  { label: 'Energisk og engasjerende', value: 'Energisk og engasjerende. Skaper entusiasme for boligen med levende språk og tempo.' },
  { label: 'Rolig og tillitsvekkende', value: 'Rolig og tillitsvekkende. Trygg, ærlig og nøktern — bygger tillit uten salgssjargong.' },
  { label: 'Saklig og presis', value: 'Saklig og presis. Faktabasert og ryddig, lar boligens kvaliteter tale for seg selv.' },
]

const AVATAR_R2 = 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/template-avatars'
const STANDARD_AVATARS = [
  { id: 'sofia',  name: 'Sofia' },
  { id: 'marius', name: 'Marius' },
  { id: 'ingrid', name: 'Ingrid' },
  { id: 'even',   name: 'Even' },
  { id: 'hanna',  name: 'Hanna' },
  { id: 'erik',   name: 'Erik' },
]

const PRESETS_BASE = 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/presets'
const AVATAR_PRESETS: Record<string, Record<string, string>> = {
  sofia:  { modern_home: `${PRESETS_BASE}/sofia_modern_home.png`,  office: `${PRESETS_BASE}/sofia_office.png`,  studio: `${PRESETS_BASE}/sofia_studio.png`,  neighborhood: `${PRESETS_BASE}/sofia_neighborhood.png`  },
  marius: { modern_home: `${PRESETS_BASE}/marius_modern_home.png`, office: `${PRESETS_BASE}/marius_office.png`, studio: `${PRESETS_BASE}/marius_studio.png`, neighborhood: `${PRESETS_BASE}/marius_neighborhood.png` },
  ingrid: { modern_home: `${PRESETS_BASE}/ingrid_modern_home.png`, office: `${PRESETS_BASE}/ingrid_office.png`, studio: `${PRESETS_BASE}/ingrid_studio.png`, neighborhood: `${PRESETS_BASE}/ingrid_neighborhood.png` },
  even:   { modern_home: `${PRESETS_BASE}/even_modern_home.png`,   office: `${PRESETS_BASE}/even_office.png`,   studio: `${PRESETS_BASE}/even_studio.png`,   neighborhood: `${PRESETS_BASE}/even_neighborhood.png`   },
  hanna:  { modern_home: `${PRESETS_BASE}/hanna_modern_home.png`,  office: `${PRESETS_BASE}/hanna_office.png`,  studio: `${PRESETS_BASE}/hanna_studio.png`,  neighborhood: `${PRESETS_BASE}/hanna_neighborhood.png`  },
  erik:   { modern_home: `${PRESETS_BASE}/erik_modern_home.png`,   office: `${PRESETS_BASE}/erik_office.png`,   studio: `${PRESETS_BASE}/erik_studio.png`,   neighborhood: `${PRESETS_BASE}/erik_neighborhood.png`   },
}

type Profile = {
  name?: string
  title?: string
  phone?: string
  email?: string
  website?: string
  voice_id?: string
  cloned_voice_id?: string
  tone_of_voice?: string
  hashtags?: string
  logo_url?: string
  portrait_url?: string
  selected_avatar_url?: string
}

type SettingImage = {
  id: string
  setting_type: string
  image_url: string
  created_at: string
  portrait_url?: string
  is_preset?: boolean
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>({})
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingPortrait, setUploadingPortrait] = useState(false)
  const [generatingSettings, setGeneratingSettings] = useState<Record<string, boolean>>({})
  const [settingErrors, setSettingErrors] = useState<Record<string, string>>({})
  const [settingImages, setSettingImages] = useState<SettingImage[]>([])
  const [selectedSetting, setSelectedSetting] = useState<string | null>(null)
  const [loadingImages, setLoadingImages] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>(SETTING_PROMPTS)
  const [showPrompt, setShowPrompt] = useState<Record<string, boolean>>({})
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [voiceRecordState, setVoiceRecordState] = useState<'idle' | 'recording' | 'cloning' | 'done' | 'error'>('idle')
  const [voiceRecordError, setVoiceRecordError] = useState('')
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const portraitRef = useRef<HTMLInputElement>(null)
  const voiceFileRef = useRef<HTMLInputElement>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Show images for the currently active portrait.
  const activePortrait = profile.portrait_url
  const activeAvatarId = STANDARD_AVATARS.find(a => `${AVATAR_R2}/${a.id}.jpg` === activePortrait)?.id

  // Pre-generated preset images for standard avatars
  const presetImages: SettingImage[] = activeAvatarId
    ? Object.entries(AVATAR_PRESETS[activeAvatarId] ?? {}).map(([settingType, imageUrl]) => ({
        id: `preset-${activeAvatarId}-${settingType}`,
        setting_type: settingType,
        image_url: imageUrl,
        created_at: '',
        portrait_url: activePortrait,
        is_preset: true,
      }))
    : []

  // User's own generated images for this portrait
  const userImages = activePortrait
    ? settingImages.filter(i => i.portrait_url === activePortrait)
    : settingImages.filter(i => !i.portrait_url)

  // User images first, presets appended after (so presets are last in the strip)
  const visibleSettingImages = [...userImages, ...presetImages]

  useEffect(() => {
    fetch('/api/profile/get')
      .then(r => r.json())
      .then(d => setProfile(d || {}))
      .catch(console.error)
    loadSettingImages()
  }, [])

  async function loadSettingImages() {
    setLoadingImages(true)
    try {
      const r = await fetch('/api/profile/settings-images')
      const d = await r.json()
      setSettingImages(Array.isArray(d) ? d : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingImages(false)
    }
  }

  function set(key: keyof Profile, val: string) {
    setProfile(p => ({ ...p, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    setSavedMsg('')
    setSaveError('')
    const res = await fetch('/api/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setSavedMsg('Lagret!')
      setTimeout(() => setSavedMsg(''), 3000)
    } else {
      setSaveError(data?.error || 'Ukjent lagrefeil')
    }
  }

  async function submitClone(audioBlob: Blob, filename: string) {
    setVoiceRecordState('cloning')
    setVoiceRecordError('')
    try {
      const fd = new FormData()
      fd.append('audio', audioBlob, filename)
      fd.append('name', profile.name || 'Meglers stemme')
      const res = await fetch('/api/profile/clone-voice', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kloning feilet')
      set('voice_id', data.voice_id)
      set('cloned_voice_id', data.voice_id)
      setVoiceRecordState('done')
    } catch (e: unknown) {
      setVoiceRecordState('error')
      setVoiceRecordError(e instanceof Error ? e.message : 'Ukjent feil')
    }
  }

  async function cloneFromFile(file: File) {
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      setVoiceRecordState('error')
      setVoiceRecordError('Velg en lyd- eller videofil (mp3, wav, m4a, mp4…)')
      return
    }
    await submitClone(file, file.name)
  }

  async function startRecording() {
    setVoiceRecordError('')
    setVoiceRecordState('recording')
    setRecordSeconds(0)
    audioChunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.start(500)
      elapsedRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
    } catch {
      setVoiceRecordState('error')
      setVoiceRecordError('Kunne ikke få tilgang til mikrofon. Sjekk tillatelser i nettleseren.')
    }
  }

  async function stopAndClone() {
    const mr = mediaRecorderRef.current
    if (!mr) return
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }

    if (recordSeconds < 10) {
      setVoiceRecordState('error')
      setVoiceRecordError('Opptaket er for kort. Ta opp minst 30 sekunder for best resultat.')
      mr.stop()
      return
    }

    mr.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      await submitClone(blob, 'recording.webm')
    }
    mr.stop()
    mr.stream.getTracks().forEach(t => t.stop())
  }

  // Krymp/nedskaler bilder i nettleseren FØR opplasting. Netlify-funksjoner kjører på
  // Lambda med ~6 MB payload-grense, og binær last base64-inflateres (×1.33) → reell
  // grense ~4.5 MB. Vi beholder HØYEST mulig kvalitet som fortsatt passer trygt under
  // grensen — portretter holder 2048px slik at avataren får skarpe ansiktsdetaljer.
  async function prepImageForUpload(file: File, type: 'logo' | 'portrait'): Promise<File> {
    // Ikke rasteriser vektor/animasjon — last opp som de er (de er små).
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file
    const BUDGET = 3_500_000 // binært mål; base64 (×1.33) ≈ 4.65 MB → trygt under 6 MB
    try {
      const url = URL.createObjectURL(file)
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image()
        im.onload = () => resolve(im)
        im.onerror = reject
        im.src = url
      })
      URL.revokeObjectURL(url)

      const render = (maxDim: number, mime: string, quality: number): Promise<Blob | null> => {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.round(img.naturalWidth * scale)
        const h = Math.round(img.naturalHeight * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return Promise.resolve(null)
        ctx.drawImage(img, 0, 0, w, h)
        return new Promise(res => canvas.toBlob(res, mime, quality))
      }

      if (type === 'logo') {
        // Behold transparens → PNG. Logoer er små; nedskaler kun dimensjon ved behov.
        const blob = await render(1000, 'image/png', 1)
        if (!blob) return file
        if (blob.size >= file.size && img.naturalWidth <= 1000 && img.naturalHeight <= 1000) return file
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' })
      }

      // Portrett: start på full kvalitet (2048px), trapp ned kun hvis vi sprenger budsjettet.
      const attempts: Array<[number, number]> = [[2048, 0.92], [2048, 0.85], [2048, 0.8], [1600, 0.85], [1280, 0.82]]
      let best: Blob | null = null
      for (const [dim, q] of attempts) {
        const blob = await render(dim, 'image/jpeg', q)
        if (!blob) continue
        best = blob
        if (blob.size <= BUDGET) break
      }
      if (!best) return file
      return new File([best], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
    } catch {
      return file // ved feil: fall tilbake til original (samme oppførsel som før)
    }
  }

  async function handleUpload(file: File, type: 'logo' | 'portrait') {
    const setter = type === 'logo' ? setUploadingLogo : setUploadingPortrait
    setter(true)
    const prepared = await prepImageForUpload(file, type)
    const fd = new FormData()
    fd.append('file', prepared)
    fd.append('type', type)
    const res = await fetch('/api/profile/upload-image', { method: 'POST', body: fd })
    setter(false)
    if (res.ok) {
      const { url } = await res.json()
      setProfile(p => ({ ...p, [`${type}_url`]: url }))
      if (type === 'portrait') {
        void Promise.all(SETTINGS.map(s => handleGenerateSetting(s.id, url)))
      }
    } else {
      alert(
        prepared.size > 4_500_000
          ? 'Bildet er for stort selv etter komprimering. Prøv et mindre bilde.'
          : 'Opplasting feilet. Prøv igjen eller bruk et mindre bilde.'
      )
    }
  }

  async function handleGenerateSetting(settingId: string, portraitOverride?: string) {
    const portraitUrl = portraitOverride || profile.portrait_url
    if (!portraitUrl) { alert('Last opp et portrettbilde først'); return }

    setGeneratingSettings(prev => ({ ...prev, [settingId]: true }))
    setSettingErrors(prev => ({ ...prev, [settingId]: '' }))

    try {
      const res = await fetch('/api/profile/generate-setting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting: settingId, portraitUrl, prompt: customPrompts[settingId] }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setSettingErrors(prev => ({ ...prev, [settingId]: data.error || `HTTP ${res.status}` }))
        return
      }
      // Vis bildet umiddelbart via midlertidig oppføring
      setSettingImages(prev => [
        ...prev,
        {
          id: `temp-${settingId}-${Date.now()}`,
          setting_type: settingId,
          image_url: data.url,
          created_at: new Date().toISOString(),
          portrait_url: portraitUrl,
        },
      ])
      // Vent på at serverdata er lastet inn FØR spinneren slås av.
      // Dermed er settingImages allerede oppdatert med ekte ID
      // i det finally-blokken kjører — ingen flash av "Ikke generert".
      await loadSettingImages()
    } catch (err) {
      setSettingErrors(prev => ({ ...prev, [settingId]: String(err) }))
    } finally {
      // Slå av spinner etter at bildet er bekreftet i state
      setGeneratingSettings(prev => ({ ...prev, [settingId]: false }))
    }
  }

  async function handleDeleteSettingImage(id: string, imageUrl: string) {
    if (!confirm('Slett dette bildet?')) return
    await fetch('/api/profile/delete-setting-image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, imageUrl }),
    })
    setSettingImages(imgs => imgs.filter(i => i.id !== id))
  }

  async function handleSelectSettingImage(url: string) {
    setSelectedSetting(url)
    await fetch('/api/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profile, selected_avatar_url: url }),
    })
    setProfile(p => ({ ...p, selected_avatar_url: url }))
  }

  async function playVoiceSample(voiceId: string, previewUrl?: string) {
    // Toggle off if the same voice is already playing
    if (playingVoiceId === voiceId) {
      voiceAudioRef.current?.pause()
      voiceAudioRef.current = null
      setPlayingVoiceId(null)
      return
    }
    // Stop whatever is currently playing
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause()
      voiceAudioRef.current = null
    }
    setPlayingVoiceId(null)

    if (previewUrl) {
      // Static preview URL — play immediately
      setPlayingVoiceId(voiceId)
      const audio = new Audio(previewUrl)
      voiceAudioRef.current = audio
      audio.onended = () => { setPlayingVoiceId(null); voiceAudioRef.current = null }
      void audio.play()
    } else {
      // No static URL → generate via TTS (used for cloned voice)
      setLoadingPreviewId(voiceId)
      try {
        const res = await fetch('/api/profile/tts-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Hei, her er din klonede stemme. Hyggelig å møte deg!', voiceId }),
        })
        if (!res.ok) throw new Error('Forhåndsvisning feilet')
        const contentType = res.headers.get('content-type') || ''
        let url: string
        if (contentType.includes('application/json')) {
          const data = await res.json() as { audioUrl?: string; audioBase64?: string }
          url = data.audioUrl || `data:audio/mpeg;base64,${data.audioBase64}`
        } else {
          const blob = await res.blob()
          url = URL.createObjectURL(blob)
        }
        setLoadingPreviewId(null)
        setPlayingVoiceId(voiceId)
        const audio = new Audio(url)
        voiceAudioRef.current = audio
        audio.onended = () => { setPlayingVoiceId(null); voiceAudioRef.current = null }
        void audio.play()
      } catch {
        setLoadingPreviewId(null)
      }
    }
  }

  return (
    <div>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <AccountTabs />
        <div>
          <h1
            className="text-xl font-semibold"
            style={{ color: 'var(--ink)', fontFamily: 'var(--sans)' }}
          >
            Meglerprofil
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Konfigurer din profil og avatar</p>
        </div>

        {/* Basic info */}
        <section className="app-card">
          <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--ink-2)', fontFamily: 'var(--mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Grunnleggende info
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ['name', 'Navn', 'text', 'Ola Nordmann'],
              ['title', 'Tittel', 'text', 'Eiendomsmegler'],
              ['phone', 'Telefon', 'tel', '+47 900 00 000'],
              ['email', 'E-post', 'email', 'ola@meglerkontor.no'],
              ['website', 'Nettside', 'url', 'https://meglerkontor.no'],
            ] as [keyof Profile, string, string, string][]).map(([key, label, type, placeholder]) => (
              <div key={key} className={key === 'website' || key === 'email' ? 'sm:col-span-2' : ''}>
                <label className="app-label">{label}</label>
                <input
                  type={type}
                  value={profile[key] || ''}
                  onChange={e => set(key, e.target.value)}
                  placeholder={placeholder}
                  className="app-input"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Voice + tone */}
        <section className="app-card">
          <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--ink-2)', fontFamily: 'var(--mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Stemme og tone
          </h2>
          <div className="space-y-5">
            <div>
              <label className="app-label mb-3">Foretrukket stemme</label>
              <div className="grid grid-cols-1 gap-2">
                {profile.cloned_voice_id && (
                  <button
                    type="button"
                    onClick={async () => {
                      set('voice_id', profile.cloned_voice_id!)
                      await fetch('/api/profile/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...profile, voice_id: profile.cloned_voice_id }),
                      })
                    }}
                    className={`app-voice-row${profile.voice_id === profile.cloned_voice_id ? ' active' : ''}`}
                  >
                    <span>🎙 Din klonede stemme</span>
                    <span className="flex items-center gap-2">
                      {profile.voice_id === profile.cloned_voice_id && (
                        <span className="text-xs" style={{ color: 'var(--gold)' }}>Aktiv</span>
                      )}
                      <span
                        onClick={e => { e.stopPropagation(); void playVoiceSample(profile.cloned_voice_id!) }}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          color: playingVoiceId === profile.cloned_voice_id || loadingPreviewId === profile.cloned_voice_id
                            ? 'var(--gold)' : 'var(--muted)',
                          cursor: 'pointer',
                        }}
                        title="Hør forhåndsvisning"
                      >
                        {loadingPreviewId === profile.cloned_voice_id
                          ? '...'
                          : playingVoiceId === profile.cloned_voice_id
                            ? '■ Stopp'
                            : '▶ Hør'}
                      </span>
                    </span>
                  </button>
                )}
                {VOICES.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={async () => {
                      set('voice_id', v.id)
                      await fetch('/api/profile/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...profile, voice_id: v.id }),
                      })
                    }}
                    className={`app-voice-row${profile.voice_id === v.id ? ' active' : ''}`}
                  >
                    <span>{v.name}</span>
                    <span
                      onClick={e => { e.stopPropagation(); void playVoiceSample(v.id, v.preview) }}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ color: playingVoiceId === v.id ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer' }}
                      title="Hør forhåndsvisning"
                    >
                      {playingVoiceId === v.id ? '■ Stopp' : '▶ Hør'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice cloning */}
            <div className="app-card-inner">
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink-2)' }}>Klon din stemme</p>
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                Ta opp minst 2 minutter, eller last opp en eksisterende lydfil. Jo mer lyd, desto bedre resultat.
              </p>

              <div className="app-reading-block mb-4">
                <p className="mb-2">Velkommen til visning av denne flotte boligen. Jeg er glad for å kunne presentere et hjem som kombinerer moderne komfort med et rolig og barnevennlig nabolag. Her har du alt du trenger innen kort rekkevidde – skoler, barnehager, dagligvarebutikker og gode kollektivforbindelser.</p>
                <p className="mb-2">La oss starte med å se på stuen, som er boligens naturlige samlingspunkt. Her er det god takhøyde, store vinduer som slipper inn rikelig med naturlig lys, og en åpen planløsning som gjør rommet luftig og innbydende. Peisen gir varme og stemning på kalde høst- og vinterkvelder.</p>
                <p className="mb-2">Kjøkkenet er nyoppusset og utstyrt med integrerte hvitevarer av høy kvalitet. Benkeplaten er i laminat, og det er god lagringsplass i skuffer og skap. Her kan hele familien samles til middag eller frokost i helgene.</p>
                <p className="mb-2">Soverommet er romslig og har plass til dobbeltseng med nattbord på begge sider. Det er innebygde garderobeskap langs én vegg, noe som gir god oppbevaringsplass. Soverommene mot bakgården er stille og lyse, med utsikt mot den velstelte hagen.</p>
                <p>Uteplassen er en av boligens store kvaliteter. En romslig terrasse med sørvestlig orientering gir sol store deler av dagen, og hagen er lav i vedlikehold. Alt i alt er dette en bolig som passer perfekt for en familie som ønsker å bo godt, med plass til både hverdagsliv og festlige anledninger.</p>
              </div>

              {(voiceRecordState === 'idle' || voiceRecordState === 'error') && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: '#8b2020', color: '#fff' }}
                  >
                    <span className="w-2 h-2 rounded-full bg-white inline-block opacity-80" /> Start opptak
                  </button>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>eller</span>
                  <button
                    onClick={() => voiceFileRef.current?.click()}
                    className="app-btn-secondary"
                  >
                    Last opp lydfil
                  </button>
                  <input
                    ref={voiceFileRef}
                    type="file"
                    accept="audio/*,video/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) cloneFromFile(f); e.target.value = '' }}
                  />
                </div>
              )}
              {voiceRecordState === 'recording' && (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium" style={{ color: '#e88888' }}>
                    <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ background: '#e88888' }} />
                    Tar opp… {recordSeconds}s {recordSeconds < 60 ? `(anbefalt: 120s+)` : ''}
                  </span>
                  <button
                    onClick={stopAndClone}
                    className="app-btn-secondary"
                  >
                    ■ Stopp og klon
                  </button>
                </div>
              )}
              {voiceRecordState === 'cloning' && (
                <p className="text-sm flex items-center gap-2" style={{ color: 'var(--gold)' }}>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Kloner stemmen din…
                </p>
              )}
              {voiceRecordState === 'done' && (
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium" style={{ color: '#7ec880' }}>✓ Stemme klonet og lagret!</p>
                  <button
                    onClick={() => { setVoiceRecordState('idle'); setRecordSeconds(0) }}
                    className="app-btn-ghost text-xs"
                  >
                    Gjør om igjen
                  </button>
                </div>
              )}
              {voiceRecordState === 'error' && (
                <p className="text-sm mt-2" style={{ color: '#e88888' }}>{voiceRecordError}</p>
              )}
            </div>

            <div>
              <label className="app-label">Tone i manus</label>
              <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                Brukes når manus genereres med stilen «Nøytral». Velg den som passer deg best.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {TONE_PRESETS.map(p => {
                  const selected = profile.tone_of_voice === p.value
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => set('tone_of_voice', p.value)}
                      style={{
                        textAlign: 'left', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                        border: selected ? '2px solid var(--blue)' : '1px solid var(--line)',
                        background: selected ? 'var(--surface-2)' : 'var(--surface)',
                      }}
                    >
                      <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{p.label}</span>
                      <span className="text-xs block" style={{ color: 'var(--muted)' }}>{p.value}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="app-label">Standard hashtags</label>
              <input
                type="text"
                value={profile.hashtags || ''}
                onChange={e => set('hashtags', e.target.value)}
                placeholder="#eiendom #boligforsalg #megler"
                className="app-input"
              />
            </div>
          </div>
        </section>

        {/* Logo upload */}
        <section className="app-card">
          <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--ink-2)', fontFamily: 'var(--mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Logo
          </h2>
          <div className="flex items-center gap-4">
            {profile.logo_url ? (
              <img
                src={profile.logo_url}
                alt="Logo"
                className="w-20 h-20 object-contain rounded-lg"
                style={{ border: '1px solid var(--line)', background: 'var(--surface-2)' }}
              />
            ) : (
              <div
                className="w-20 h-20 rounded-lg flex items-center justify-center text-xs text-center px-2"
                style={{ border: '2px dashed var(--line-2)', color: 'var(--muted)' }}
              >
                Ingen logo
              </div>
            )}
            <div>
              <button
                onClick={() => logoRef.current?.click()}
                disabled={uploadingLogo}
                className="app-btn-secondary"
              >
                {uploadingLogo ? 'Laster opp...' : 'Last opp logo'}
              </button>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>PNG eller SVG anbefalt</p>
            </div>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo')}
            />
          </div>
        </section>

        {/* Portrait + AI settings */}
        <section className="app-card">
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--ink-2)', fontFamily: 'var(--mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Avatar og setting
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            Velg hvem som skal presentere boligene dine. Last opp ditt eget bilde, eller velg en av våre avatarer.
          </p>

          {/* Avatar selector row */}
          <div className="flex gap-3 overflow-x-auto pb-2 mb-5" style={{ overscrollBehaviorX: 'contain' }}>

            {/* Own portrait */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <button
                onClick={() => portraitRef.current?.click()}
                disabled={uploadingPortrait}
                style={{
                  width: 64, height: 64, borderRadius: 12, overflow: 'hidden',
                  border: (profile.portrait_url && !STANDARD_AVATARS.some(a => profile.portrait_url?.includes(a.id)))
                    ? '2px solid var(--blue)' : '2px dashed var(--line-2)',
                  background: 'var(--surface-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0, flexShrink: 0,
                }}
                title="Last opp eget bilde"
              >
                {uploadingPortrait ? (
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>...</span>
                ) : profile.portrait_url && !STANDARD_AVATARS.some(a => profile.portrait_url?.includes(a.id)) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.portrait_url} alt="Din avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
                ) : (
                  <span style={{ fontSize: 24, color: 'var(--muted)' }}>＋</span>
                )}
              </button>
              <span className="text-[10px] text-center" style={{ color: 'var(--muted)', maxWidth: 64 }}>
                {profile.portrait_url && !STANDARD_AVATARS.some(a => profile.portrait_url?.includes(a.id)) ? 'Din avatar' : 'Last opp'}
              </span>
              <input
                ref={portraitRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'portrait')}
              />
            </div>

            {/* Divider */}
            <div style={{ width: 1, background: 'var(--line)', margin: '4px 0', flexShrink: 0 }} />

            {/* Standard avatars */}
            {STANDARD_AVATARS.map(av => {
              const avatarUrl = `${AVATAR_R2}/${av.id}.jpg`
              const isSelected = profile.portrait_url === avatarUrl
              return (
                <button
                  key={av.id}
                  onClick={async () => {
                    setProfile(p => ({ ...p, portrait_url: avatarUrl }))
                    await fetch('/api/profile/save', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...profile, portrait_url: avatarUrl }),
                    })
                  }}
                  className="flex flex-col items-center gap-1 flex-shrink-0"
                  title={av.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt={av.name}
                    style={{
                      width: 64, height: 64, objectFit: 'cover', objectPosition: 'center 15%',
                      borderRadius: 12,
                      border: isSelected ? '2px solid var(--blue)' : '2px solid transparent',
                      boxShadow: isSelected ? '0 0 0 2px rgba(37,99,235,0.2)' : 'none',
                    }}
                  />
                  <span className="text-[10px]" style={{ color: isSelected ? 'var(--blue)' : 'var(--muted)' }}>
                    {av.name}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Setting generator */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '20px' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>Settings-bibliotek</h3>
              {visibleSettingImages.length > 0 && profile.portrait_url && (
                <button
                  onClick={async () => { void Promise.all(SETTINGS.map(s => handleGenerateSetting(s.id))) }}
                  disabled={Object.values(generatingSettings).some(Boolean)}
                  className="app-btn-ghost text-xs"
                  style={{ color: 'var(--muted)' }}
                  title="Erstatter alle 4 bilder med nye versjoner"
                >
                  ↺ Regenerer alle
                </button>
              )}
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              {activeAvatarId
                ? 'Preset-bilder er klare til bruk. Klikk for å velge aktivt bilde, eller generer din egen versjon.'
                : profile.portrait_url
                  ? 'Disse bildene velger du fra når du lager en video. Slett de du ikke vil beholde.'
                  : 'Last opp et portrettbilde — alle 4 settings genereres automatisk.'}
            </p>
            {profile.portrait_url && !activeAvatarId && userImages.length === 0 && !Object.values(generatingSettings).some(Boolean) && (
              <button
                onClick={async () => { void Promise.all(SETTINGS.map(s => handleGenerateSetting(s.id))) }}
                className="app-btn-secondary mb-4"
                style={{ fontSize: '13px' }}
              >
                Generer alle 4 settings
              </button>
            )}
            <div className="space-y-5">
              {SETTINGS.map(s => {
                const allForType = visibleSettingImages.filter(i => i.setting_type === s.id)
                const isGenerating = generatingSettings[s.id]
                const err = settingErrors[s.id]
                return (
                  <div key={s.id} className="space-y-2">
                    {/* Row header */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>{s.label}</p>
                      <div className="flex items-center gap-3">
                        {err && (
                          <span className="text-xs" style={{ color: '#e88888' }}>{err}</span>
                        )}
                        <button
                          onClick={() => handleGenerateSetting(s.id)}
                          disabled={!profile.portrait_url || isGenerating}
                          className="text-xs"
                          style={{ color: isGenerating ? 'var(--muted)' : 'var(--gold)', opacity: profile.portrait_url ? 1 : 0.4 }}
                          title="Generer nytt bilde for denne settingen"
                        >
                          {isGenerating ? '...' : '+ Generer nytt'}
                        </button>
                      </div>
                    </div>

                    {/* Image strip */}
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ overscrollBehaviorX: 'contain' }}>
                      {/* Generating placeholder */}
                      {isGenerating && (
                        <div
                          className="flex-shrink-0 rounded-lg flex flex-col items-center justify-center gap-2"
                          style={{ width: '160px', height: '90px', background: 'var(--surface-2)', border: '1px solid var(--line)' }}
                        >
                          <svg className="animate-spin h-5 w-5" style={{ color: 'var(--gold)' }} fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span className="text-[10px]" style={{ color: 'var(--gold)' }}>Genererer…</span>
                        </div>
                      )}

                      {/* Existing images — newest first */}
                      {[...allForType].reverse().map(img => (
                        <div
                          key={img.id}
                          className="relative flex-shrink-0 rounded-lg overflow-hidden group"
                          style={{
                            width: '160px', height: '90px',
                            border: `2px solid ${profile.selected_avatar_url === img.image_url ? '#4ade80' : 'transparent'}`,
                          }}
                        >
                          <img
                            src={img.image_url}
                            alt={s.label}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => handleSelectSettingImage(img.image_url)}
                            title="Klikk for å merke som aktiv"
                          />
                          {/* Active badge */}
                          {profile.selected_avatar_url === img.image_url && (
                            <span
                              className="absolute top-1 left-1 text-[9px] font-semibold px-1.5 py-0.5 rounded pointer-events-none"
                              style={{ background: '#4ade80', color: '#052e16' }}
                            >
                              ✓ Aktiv
                            </span>
                          )}
                          {/* Preset badge */}
                          {img.is_preset && profile.selected_avatar_url !== img.image_url && (
                            <span
                              className="absolute top-1 left-1 text-[9px] px-1.5 py-0.5 rounded pointer-events-none"
                              style={{ background: 'rgba(13,11,8,0.55)', color: 'rgba(244,236,220,0.7)' }}
                            >
                              Preset
                            </span>
                          )}
                          {/* Overlay buttons — visible on hover */}
                          <div
                            className="absolute inset-0 flex items-end justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)' }}
                          >
                            <button
                              onClick={e => { e.stopPropagation(); setLightbox(img.image_url) }}
                              title="Forstørr"
                              className="w-6 h-6 flex items-center justify-center rounded text-[11px]"
                              style={{ background: 'rgba(13,11,8,0.6)', color: 'rgba(244,236,220,0.85)' }}
                            >⤢</button>
                            {!img.is_preset && (
                              <button
                                onClick={e => { e.stopPropagation(); handleDeleteSettingImage(img.id, img.image_url) }}
                                title="Slett dette bildet"
                                className="w-6 h-6 flex items-center justify-center rounded text-[11px]"
                                style={{ background: 'rgba(180,30,30,0.7)', color: '#fff' }}
                              >✕</button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Empty state */}
                      {allForType.length === 0 && !isGenerating && (
                        <div
                          className="flex-shrink-0 rounded-lg flex items-center justify-center"
                          style={{ width: '160px', height: '90px', background: 'var(--surface-2)', border: '2px dashed var(--line-2)' }}
                        >
                          <span className="text-xs text-center px-3" style={{ color: 'var(--muted)' }}>Ikke generert</span>
                        </div>
                      )}
                    </div>

                    {/* Prompt editor */}
                    <button
                      type="button"
                      onClick={() => setShowPrompt(p => ({ ...p, [s.id]: !p[s.id] }))}
                      className="text-xs"
                      style={{ color: 'var(--gold)', opacity: 0.6 }}
                    >
                      {showPrompt[s.id] ? '▲ Skjul prompt' : '✎ Rediger prompt'}
                    </button>
                    {showPrompt[s.id] && (
                      <textarea
                        rows={5}
                        value={customPrompts[s.id] || ''}
                        onChange={e => setCustomPrompts(p => ({ ...p, [s.id]: e.target.value }))}
                        className="app-textarea"
                        style={{ fontSize: '11px' }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {loadingImages && <p className="text-sm mt-3" style={{ color: 'var(--muted)' }}>Laster bilder...</p>}
        </section>

        {/* Save button */}
        <div className="flex items-center gap-4 pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="app-btn-primary"
          >
            {saving ? 'Lagrer...' : 'Lagre profil'}
          </button>
          {savedMsg && <span className="text-sm font-medium" style={{ color: '#7ec880' }}>{savedMsg}</span>}
          {saveError && <span className="text-sm" style={{ color: '#e88888' }}>{saveError}</span>}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Forstørret"
            className="max-w-full max-h-full rounded-xl"
            style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 rounded-full w-9 h-9 flex items-center justify-center text-lg"
            style={{ background: 'rgba(13,11,8,0.7)', color: 'var(--ink)', border: '1px solid var(--line-2)' }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
