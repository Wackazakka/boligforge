'use client'

import { useEffect, useRef, useState } from 'react'

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
  { id: 'modern_home', label: 'Foran en moderne bolig (utendørs)' },
  { id: 'office', label: 'I et lyst, profesjonelt kontor' },
  { id: 'studio', label: 'Nøytral studiobakgrunn' },
  { id: 'neighborhood', label: 'Utendørs i et boligfelt' },
  { id: 'property_front', label: 'Foran eiendommen (Finn.no-bilde)' },
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
  const [generatingSetting, setGeneratingSetting] = useState<string | null>(null)
  const [settingImages, setSettingImages] = useState<SettingImage[]>([])
  const [selectedSetting, setSelectedSetting] = useState<string | null>(null)
  const [loadingImages, setLoadingImages] = useState(false)
  const [propertyTestUrl, setPropertyTestUrl] = useState('')
  const logoRef = useRef<HTMLInputElement>(null)
  const portraitRef = useRef<HTMLInputElement>(null)

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
    const res = await fetch('/api/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    setSaving(false)
    if (res.ok) {
      setSavedMsg('Lagret!')
      setTimeout(() => setSavedMsg(''), 3000)
    } else {
      setSavedMsg('Feil ved lagring')
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
    } else {
      alert('Opplasting feilet')
    }
  }

  async function handleGenerateSetting(settingId: string) {
    if (!profile.portrait_url) {
      alert('Last opp et portrettbilde først')
      return
    }
    if (settingId === 'property_front' && !propertyTestUrl.trim()) {
      alert('Lim inn en URL til et boligbilde for å teste «Foran eiendommen»')
      return
    }
    setGeneratingSetting(settingId)
    const res = await fetch('/api/profile/generate-setting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setting: settingId,
        portraitUrl: profile.portrait_url,
        ...(settingId === 'property_front' ? { propertyImageUrl: propertyTestUrl.trim() } : {}),
      }),
    })
    setGeneratingSetting(null)
    try {
      const text = await res.text()
      const lastLine = text.trim().split('\n').pop() || '{}'
      const data = JSON.parse(lastLine)
      if (data.error) {
        alert('Generering feilet: ' + data.error)
      } else {
        loadSettingImages()
      }
    } catch {
      alert(`Generering feilet: HTTP ${res.status}`)
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
      body: JSON.stringify({ ...profile, portrait_url: url }),
    })
    setProfile(p => ({ ...p, portrait_url: url }))
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
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Generer setting-bilde</h3>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Boligbilde-URL <span className="text-gray-400 font-normal">(for «Foran eiendommen» — erstattes av Finn.no-scraper)</span>
              </label>
              <input
                type="url"
                value={propertyTestUrl}
                onChange={e => setPropertyTestUrl(e.target.value)}
                placeholder="https://eksempel.no/boligbilde.jpg"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {generatingSetting && (
              <div className="mb-3 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="animate-spin inline-block">⟳</span>
                Genererer bilde — dette tar 30–60 sekunder...
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SETTINGS.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleGenerateSetting(s.id)}
                  disabled={!!generatingSetting || !profile.portrait_url}
                  className="text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generatingSetting === s.id ? (
                    <span className="text-blue-600 font-medium">⟳ Genererer...</span>
                  ) : s.label}
                </button>
              ))}
            </div>
            {!profile.portrait_url && (
              <p className="text-xs text-gray-400 mt-2">Last opp et portrettbilde for å aktivere setting-generator</p>
            )}
          </div>

          {/* Generated images gallery */}
          {settingImages.length > 0 && (
            <div className="border-t border-gray-100 pt-5 mt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Lagrede setting-bilder</h3>
                <span className="text-xs text-gray-400">{settingImages.length} bilde{settingImages.length !== 1 ? 'r' : ''} lagret</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {settingImages.map(img => {
                  const isSelected = profile.portrait_url === img.image_url
                  return (
                    <div
                      key={img.id}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all ${isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'}`}
                    >
                      <button
                        onClick={() => handleSelectSettingImage(img.image_url)}
                        className="block w-full"
                      >
                        <img src={img.image_url} alt={img.setting_type} className="w-full aspect-square object-cover" />
                      </button>
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1.5 flex items-center justify-between gap-1">
                        <span className="text-white text-xs truncate">
                          {SETTINGS.find(s => s.id === img.setting_type)?.label || img.setting_type}
                        </span>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleGenerateSetting(img.setting_type)}
                            disabled={!!generatingSetting || !profile.portrait_url}
                            title="Generer nytt"
                            className="w-6 h-6 rounded bg-white/20 hover:bg-white/40 flex items-center justify-center text-white text-xs disabled:opacity-50"
                          >
                            {generatingSetting === img.setting_type ? '⟳' : '↺'}
                          </button>
                          <a
                            href={img.image_url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Last ned"
                            className="w-6 h-6 rounded bg-white/20 hover:bg-white/40 flex items-center justify-center text-white text-xs"
                          >
                            ↓
                          </a>
                          <button
                            onClick={() => handleDeleteSettingImage(img.id, img.image_url)}
                            title="Slett bilde"
                            className="w-6 h-6 rounded bg-red-500/60 hover:bg-red-500/90 flex items-center justify-center text-white text-xs"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">Klikk på et bilde for å velge det som aktivt portrett. Trykk ↺ for å generere et nytt bilde med samme setting.</p>
            </div>
          )}

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
        </div>
      </div>
    </div>
  )
}
