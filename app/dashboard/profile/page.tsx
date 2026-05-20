'use client'

import { useEffect, useRef, useState } from 'react'
const SETTING_PROMPTS: Record<string, string> = {
  modern_home: 'A professional Norwegian real estate agent standing outdoors in front of a beautiful modern Norwegian home. White render walls, large black-frame windows, lush green garden, warm golden-hour sunlight. The agent is smiling confidently, wearing business casual attire. Editorial real estate photography, shallow depth of field.',
  office: 'A professional Norwegian real estate agent standing in a bright Scandinavian open-plan office. Light wood surfaces, tall windows with soft daylight, subtle greenery in the background. The agent looks approachable and confident. Clean editorial photography look.',
  studio: 'A professional Norwegian real estate agent against a smooth warm-neutral gradient studio backdrop. Soft, even professional lighting from the side. Confident, friendly expression. High-end professional headshot, sharp focus on face.',
  neighborhood: 'A professional Norwegian real estate agent standing outdoors on a sunny Norwegian residential street. Traditional wooden houses painted in muted colors, leafy trees, clear blue sky, golden afternoon light. The agent is relaxed and smiling. Editorial lifestyle photography.',
}

const VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel – Rolig, naturlig' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi – Energisk' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella – Varm' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni – Profesjonell' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli – Engasjert' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum – Trygg' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam – Dyp' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam – Vennlig' },
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
  const logoRef = useRef<HTMLInputElement>(null)
  const portraitRef = useRef<HTMLInputElement>(null)
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

    const prompt = SETTING_PROMPTS[settingId]
    if (!prompt) { alert('Ukjent setting-type'); return }

    setGeneratingSettings(prev => ({ ...prev, [settingId]: true }))
    setSettingErrors(prev => ({ ...prev, [settingId]: '' }))

    try {
      // Ideogram V3 Character: purpose-built for consistent character appearance
      // across scenes. Far superior face fidelity vs FLUX PuLID / SDXL PuLID / InstantID.
      // Step 1: submit to queue (returns immediately)
      const MODEL_PATH = 'fal-ai/ideogram/character'
      const submitRes = await fetch('/api/fal/proxy', {
        method: 'POST',
        headers: {
          'x-fal-target-url': `https://queue.fal.run/${MODEL_PATH}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference_image_urls: [portraitUrl],
          prompt,
          negative_prompt: 'blurry, distorted face, deformed, extra fingers, bad anatomy, watermark, text, cartoon, illustration, painting, unrealistic skin',
          rendering_speed: 'BALANCED',
          style: 'REALISTIC',
          expand_prompt: false,
          num_images: 1,
          seed: Math.floor(Math.random() * 999999999),
        }),
      })
      if (!submitRes.ok) {
        const errText = await submitRes.text()
        setSettingErrors(prev => ({ ...prev, [settingId]: `Innsending feilet: ${errText.slice(0, 150)}` }))
        return
      }
      const submitData = await submitRes.json()
      const request_id = submitData?.request_id
      if (!request_id) {
        setSettingErrors(prev => ({ ...prev, [settingId]: `Ingen request_id: ${JSON.stringify(submitData).slice(0, 150)}` }))
        return
      }

      // Step 2: poll status every 3s (max 7 min for QUALITY rendering)
      let falImageUrl: string | null = null
      for (let i = 0; i < 140; i++) {
        await new Promise(r => setTimeout(r, 3000))
        const statusRes = await fetch('/api/fal/proxy', {
          method: 'GET',
          headers: { 'x-fal-target-url': `https://queue.fal.run/${MODEL_PATH}/requests/${request_id}/status` },
        })
        if (!statusRes.ok) continue
        const status = await statusRes.json()
        if (status.status === 'COMPLETED') {
          // Step 3: fetch result
          const resultRes = await fetch('/api/fal/proxy', {
            method: 'GET',
            headers: { 'x-fal-target-url': `https://queue.fal.run/${MODEL_PATH}/requests/${request_id}` },
          })
          const resultData = await resultRes.json()
          falImageUrl =
            resultData?.images?.[0]?.url ??
            resultData?.output?.images?.[0]?.url ??
            resultData?.data?.images?.[0]?.url ??
            null
          break
        }
        if (status.status === 'FAILED') {
          setSettingErrors(prev => ({ ...prev, [settingId]: `fal.ai generering feilet: ${JSON.stringify(status).slice(0, 150)}` }))
          return
        }
      }

      if (!falImageUrl) {
        setSettingErrors(prev => ({ ...prev, [settingId]: 'Timeout: ingen bilde returnert etter 7 min' }))
        return
      }

      // Step 4: save to R2 + Supabase (fast, <5s)
      const saveRes = await fetch('/api/profile/save-generated-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ falImageUrl, setting: settingId }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok || saveData.error) {
        setSettingErrors(prev => ({ ...prev, [settingId]: saveData.error || 'Lagring feilet' }))
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
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Meglerprofil</h1>
        <p className="text-sm text-gray-500 mt-0.5">Konfigurer din profil og avatar</p>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Foretrukket stemme (ElevenLabs)</label>
              <select
                value={profile.voice_id || ''}
                onChange={e => set('voice_id', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Velg stemme...</option>
                {VOICES.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
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
                    <div className="relative rounded-lg overflow-hidden bg-gray-100 aspect-[3/4]">
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
                          <img src={existing.image_url} alt={s.label} className="w-full h-full object-cover" />
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
                    <p className="text-xs text-gray-500 text-center leading-tight">{s.label}</p>
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
    </div>
  )
}
