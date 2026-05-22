'use client'

import { useEffect, useRef, useState } from 'react'
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

type Profile = {
  name?: string
  title?: string
  phone?: string
  email?: string
  website?: string
  voice_id?: string
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
  const logoRef = useRef<HTMLInputElement>(null)
  const portraitRef = useRef<HTMLInputElement>(null)
  const voiceFileRef = useRef<HTMLInputElement>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/profile/get')
      .then(r => r.json())
      .then(d => setProfile(d || {}))
      .catch(console.error)
    loadSettingImages()
  }, [])

  function loadSettingImages() {
    setLoadingImages(true)
    fetch('/api/profile/settings-images')
      .then(r => r.json())
      .then(d => setSettingImages(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoadingImages(false))
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

  async function handleUpload(file: File, type: 'logo' | 'portrait') {
    const setter = type === 'logo' ? setUploadingLogo : setUploadingPortrait
    setter(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)
    const res = await fetch('/api/profile/upload-image', { method: 'POST', body: fd })
    setter(false)
    if (res.ok) {
      const { url } = await res.json()
      setProfile(p => ({ ...p, [`${type}_url`]: url }))
      // Auto-generate all 4 settings sequentially after portrait upload
      if (type === 'portrait') {
        ;(async () => { for (const s of SETTINGS) await handleGenerateSetting(s.id, url) })()
      }
    } else {
      alert('Opplasting feilet')
    }
  }

async function handleGenerateSetting(settingId: string, portraitOverride?: string) {
    const portraitUrl = portraitOverride || profile.portrait_url
    if (!portraitUrl) { alert('Last opp et portrettbilde først'); return }

    setGeneratingSettings(prev => ({ ...prev, [settingId]: true }))
    setSettingErrors(prev => ({ ...prev, [settingId]: '' }))

    try {
      // Single server-side call: sync fal.ai (~14s) + R2 upload + Supabase insert.
      // Server route has maxDuration=120, so no timeout. No client polling needed.
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
      loadSettingImages()
    } catch (err) {
      setSettingErrors(prev => ({ ...prev, [settingId]: String(err) }))
    } finally {
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
    // Store selected avatar separately — do NOT overwrite portrait_url
    await fetch('/api/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profile, selected_avatar_url: url }),
    })
    setProfile(p => ({ ...p, selected_avatar_url: url }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Meglerprofil</h1>
          <p className="text-sm text-gray-500 mt-0.5">Konfigurer din profil og avatar</p>
        </div>

        {/* Basic info */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Grunnleggende info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ['name', 'Navn', 'text', 'Ola Nordmann'],
              ['title', 'Tittel', 'text', 'Eiendomsmegler'],
              ['phone', 'Telefon', 'tel', '+47 900 00 000'],
              ['email', 'E-post', 'email', 'ola@meglerkontor.no'],
              ['website', 'Nettside', 'url', 'https://meglerkontor.no'],
            ] as [keyof Profile, string, string, string][]).map(([key, label, type, placeholder]) => (
              <div key={key} className={key === 'website' || key === 'email' ? 'sm:col-span-2' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={profile[key] || ''}
                  onChange={e => set(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Voice + tone */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Stemme og tone</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Foretrukket stemme</label>
              <div className="grid grid-cols-1 gap-2">
                {/* Cloned voice appears first if set */}
                {profile.voice_id && !VOICES.find(v => v.id === profile.voice_id) && (
                  <button
                    key="cloned"
                    type="button"
                    onClick={async () => {
                      // already active — no-op
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-blue-500 bg-blue-50 text-blue-800 text-sm font-medium text-left"
                  >
                    <span>🎙 Din klonede stemme</span>
                    <span className="text-xs text-blue-500">Aktiv</span>
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
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                      profile.voice_id === v.id
                        ? 'border-blue-500 bg-blue-50 text-blue-800 font-medium'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <span>{v.name}</span>
                    <span
                      onClick={e => { e.stopPropagation(); new Audio(v.preview).play() }}
                      className="ml-2 text-gray-400 hover:text-blue-600 text-xs px-2 py-0.5 rounded hover:bg-blue-100"
                      title="Hør forhåndsvisning"
                    >▶ Hør</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Voice cloning */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <p className="text-sm font-medium text-gray-700 mb-1">Klon din stemme</p>
              <p className="text-xs text-gray-500 mb-3">
                Ta opp minst 2 minutter, eller last opp en eksisterende lydfil. Jo mer lyd, desto bedre resultat.
              </p>

              {/* Reading text */}
              <div className="bg-white border border-gray-200 rounded p-3 text-sm text-gray-600 mb-4 leading-relaxed max-h-48 overflow-y-auto">
                <p className="mb-2">Velkommen til visning av denne flotte boligen. Jeg er glad for å kunne presentere et hjem som kombinerer moderne komfort med et rolig og barnevennlig nabolag. Her har du alt du trenger innen kort rekkevidde – skoler, barnehager, dagligvarebutikker og gode kollektivforbindelser.</p>
                <p className="mb-2">La oss starte med å se på stuen, som er boligens naturlige samlingspunkt. Her er det god takhøyde, store vinduer som slipper inn rikelig med naturlig lys, og en åpen planløsning som gjør rommet luftig og innbydende. Peisen gir varme og stemning på kalde høst- og vinterkvelder.</p>
                <p className="mb-2">Kjøkkenet er nyoppusset og utstyrt med integrerte hvitevarer av høy kvalitet. Benkeplaten er i laminat, og det er god lagringsplass i skuffer og skap. Her kan hele familien samles til middag eller frokost i helgene.</p>
                <p className="mb-2">Soverommet er romslig og har plass til dobbeltseng med nattbord på begge sider. Det er innebygde garderobeskap langs én vegg, noe som gir god oppbevaringsplass. Soverommene mot bakgården er stille og lyse, med utsikt mot den velstelte hagen.</p>
                <p>Uteplassen er en av boligens store kvaliteter. En romslig terrasse med sørvestlig orientering gir sol store deler av dagen, og hagen er lav i vedlikehold. Alt i alt er dette en bolig som passer perfekt for en familie som ønsker å bo godt, med plass til både hverdagsliv og festlige anledninger.</p>
              </div>

              {/* Record controls */}
              {(voiceRecordState === 'idle' || voiceRecordState === 'error') && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                  >
                    <span className="w-2 h-2 rounded-full bg-white inline-block" /> Start opptak
                  </button>
                  <span className="text-xs text-gray-400">eller</span>
                  <button
                    onClick={() => voiceFileRef.current?.click()}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400 hover:bg-white"
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
                  <span className="flex items-center gap-2 text-sm text-red-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse inline-block" />
                    Tar opp… {recordSeconds}s {recordSeconds < 60 ? `(anbefalt: 120s+)` : ''}
                  </span>
                  <button
                    onClick={stopAndClone}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900"
                  >
                    ■ Stopp og klon
                  </button>
                </div>
              )}
              {voiceRecordState === 'cloning' && (
                <p className="text-sm text-blue-600 flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Kloner stemmen din…
                </p>
              )}
              {voiceRecordState === 'done' && (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-green-600 font-medium">✓ Stemme klonet og lagret!</p>
                  <button onClick={() => { setVoiceRecordState('idle'); setRecordSeconds(0) }} className="text-xs text-gray-400 hover:text-gray-600 underline">Gjør om igjen</button>
                </div>
              )}
              {voiceRecordState === 'error' && (
                <p className="text-sm text-red-600 mt-2">{voiceRecordError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tone of voice</label>
              <textarea
                rows={3}
                value={profile.tone_of_voice || ''}
                onChange={e => set('tone_of_voice', e.target.value)}
                placeholder="F.eks: Varm og profesjonell. Snakker klart og tydelig om boligens fordeler. Unngår salgssjargong og er ærlig."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Standard hashtags</label>
              <input
                type="text"
                value={profile.hashtags || ''}
                onChange={e => set('hashtags', e.target.value)}
                placeholder="#eiendom #boligforsalg #megler"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        {/* Logo upload */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Logo</h2>
          <div className="flex items-center gap-4">
            {profile.logo_url ? (
              <img src={profile.logo_url} alt="Logo" className="w-20 h-20 object-contain rounded-lg border border-gray-200 bg-gray-50" />
            ) : (
              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs">Ingen logo</div>
            )}
            <div>
              <button
                onClick={() => logoRef.current?.click()}
                disabled={uploadingLogo}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 disabled:opacity-50"
              >
                {uploadingLogo ? 'Laster opp...' : 'Last opp logo'}
              </button>
              <p className="text-xs text-gray-500 mt-1">PNG eller SVG anbefalt</p>
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
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Portrettbilde og setting</h2>
          <p className="text-sm text-gray-500 mb-5">Last opp et portrettbilde, deretter generer en profesjonell setting med AI. Ansiktet ditt bevares i alle settings.</p>

          <div className="flex items-center gap-4 mb-6">
            {profile.portrait_url ? (
              <img src={profile.portrait_url} alt="Portrett" className="w-24 h-24 object-cover rounded-xl border border-gray-200" />
            ) : (
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs text-center px-2">Ingen bilde</div>
            )}
            <div>
              <button
                onClick={() => portraitRef.current?.click()}
                disabled={uploadingPortrait}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 disabled:opacity-50"
              >
                {uploadingPortrait ? 'Laster opp...' : 'Last opp portrett'}
              </button>
              <p className="text-xs text-gray-500 mt-1">Bruk et godt, klart ansiktsbilde</p>
            </div>
            <input
              ref={portraitRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'portrait')}
            />
          </div>

          {/* Setting generator */}
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-700">Settings-bibliotek</h3>
              {profile.portrait_url && (
                <button
                  onClick={async () => { for (const s of SETTINGS) await handleGenerateSetting(s.id) }}
                  disabled={Object.values(generatingSettings).some(Boolean)}
                  className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                >
                  ↺ Generer alle på nytt
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {profile.portrait_url
                ? 'Klikk ↺ på et bilde for å regenerere det. Disse settingsene er tilgjengelige på alle eiendomssider.'
                : 'Last opp et portrettbilde — alle 4 settings genereres automatisk.'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SETTINGS.map(s => {
                const existing = settingImages.find(i => i.setting_type === s.id)
                const isGenerating = generatingSettings[s.id]
                const err = settingErrors[s.id]
                return (
                  <div key={s.id} className="space-y-1">
                    <div className="relative rounded-lg overflow-hidden bg-gray-100 aspect-video">
                      {isGenerating ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <svg className="animate-spin h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span className="text-xs text-blue-400">Genererer...</span>
                        </div>
                      ) : err ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-2">
                          <span className="text-xs text-center text-red-400">{err}</span>
                          <button onClick={() => handleGenerateSetting(s.id)} disabled={!profile.portrait_url} className="text-xs text-blue-500 hover:underline disabled:opacity-50">↺ Prøv igjen</button>
                        </div>
                      ) : existing ? (
                        <>
                          <img
                            src={existing.image_url}
                            alt={s.label}
                            className="w-full h-full object-cover cursor-zoom-in"
                            onClick={() => setLightbox(existing.image_url)}
                          />
                          <span className="absolute bottom-1 left-1 text-[10px] text-white/70 bg-black/40 rounded px-1">
                            {new Date(existing.created_at).toLocaleTimeString('no', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-xs text-gray-400 text-center px-2">Ikke generert</span>
                        </div>
                      )}
                      {existing && !isGenerating && !err && (
                        <button
                          onClick={() => handleGenerateSetting(s.id)}
                          disabled={!profile.portrait_url}
                          title="Generer nytt"
                          className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white text-sm disabled:opacity-50"
                        >
                          ↺
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 leading-tight">{s.label}</p>
                    <button
                      type="button"
                      onClick={() => setShowPrompt(p => ({ ...p, [s.id]: !p[s.id] }))}
                      className="text-xs text-blue-500 hover:underline text-left"
                    >
                      {showPrompt[s.id] ? '▲ Skjul prompt' : '✎ Rediger prompt'}
                    </button>
                    {showPrompt[s.id] && (
                      <textarea
                        rows={5}
                        value={customPrompts[s.id] || ''}
                        onChange={e => setCustomPrompts(p => ({ ...p, [s.id]: e.target.value }))}
                        className="w-full text-[11px] border border-gray-200 rounded-md px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y bg-gray-50"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

            {loadingImages && <p className="text-sm text-gray-400 mt-3">Laster bilder...</p>}
        </section>

        {/* Save button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm disabled:opacity-50"
          >
            {saving ? 'Lagrer...' : 'Lagre profil'}
          </button>
          {savedMsg && <span className="text-sm text-green-600 font-medium">{savedMsg}</span>}
          {saveError && <span className="text-sm text-red-600">{saveError}</span>}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Forstørret"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 rounded-full w-9 h-9 flex items-center justify-center text-lg"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
