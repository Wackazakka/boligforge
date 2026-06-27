'use client'

// Superadmin: interaktiv priskalkyle for digital visning. Modellerer én meglers
// økonomi — juster volum/påslag/kostnader og se margin live. Foto-avatar = sett
// custom avatar + PVC til 0; video-avatar = $49 avatar; + PVC = $100 stemme-slot.

import { useState } from 'react'

const TTS = 0.05, CLAUDE = 0.005

function kr(x: number) { return Math.round(x).toLocaleString('nb-NO') + ' kr' }

function Slider({ label, val, set, min, max, step, fmt }: {
  label: string; val: number; set: (n: number) => void; min: number; max: number; step: number; fmt: (n: number) => string
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
        <span>{label}</span><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{fmt(val)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={e => set(Number(e.target.value))} style={{ width: '100%' }} />
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface-2, #f5f5f5)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>{value}</div>
    </div>
  )
}

export default function KalkylePage() {
  const [kurs, setKurs] = useState(11)
  const [markup, setMarkup] = useState(100)
  const [vis, setVis] = useState(20)
  const [minp, setMinp] = useState(5)
  const [av, setAv] = useState(49)
  const [pvc, setPvc] = useState(100)
  const [prem, setPrem] = useState(2500)
  const [mode, setMode] = useState<'full' | 'lite' | 'did'>('full')

  const la = mode === 'full' ? 0.20 : mode === 'lite' ? 0.10 : 0.40
  const costMin = (la + TTS + CLAUDE) * kurs
  const priceMin = costMin * (1 + markup / 100)
  const mins = vis * minp
  const usageCost = mins * costMin, usageRev = mins * priceMin
  const fixedCost = (av + pvc) * kurs
  const rev = usageRev + prem
  const cost = usageCost + fixedCost
  const profit = rev - cost
  const mk = cost > 0 ? (profit / cost) * 100 : 0
  const ok = mk >= 100

  const modeBtn = (m: 'full' | 'lite' | 'did', label: string) => (
    <button onClick={() => setMode(m)} style={{
      padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      background: 'var(--surface)', color: 'var(--ink)',
      border: mode === m ? '2px solid var(--blue, #2563eb)' : '1px solid var(--line)',
    }}>{label}</button>
  )

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Priskalkyle — digital visning</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18 }}>
        Margin per megler. Foto-avatar (D-ID): velg D-ID-modus + custom avatar 0. Video-avatar: LiveAvatar-modus + $49 avatar. + proff-stemme: $100 stemme-slot.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
        <Slider label="USD → NOK kurs" val={kurs} set={setKurs} min={9} max={13} step={0.5} fmt={n => String(n)} />
        <Slider label="Påslag" val={markup} set={setMarkup} min={0} max={300} step={10} fmt={n => `${n} %`} />
        <Slider label="Visninger / mnd" val={vis} set={setVis} min={0} max={80} step={5} fmt={n => String(n)} />
        <Slider label="Minutter / visning" val={minp} set={setMinp} min={1} max={15} step={1} fmt={n => String(n)} />
        <Slider label="Custom avatar ($/mnd)" val={av} set={setAv} min={0} max={100} step={1} fmt={n => `$${n}`} />
        <Slider label="PVC-slot ($/mnd)" val={pvc} set={setPvc} min={0} max={150} step={10} fmt={n => `$${n}`} />
        <Slider label="Fast pris til megler (kr/mnd)" val={prem} set={setPrem} min={0} max={8000} step={250} fmt={kr} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Leverandør / modus</span>
        {modeBtn('full', 'LiveAvatar FULL ($0,20)')}
        {modeBtn('lite', 'LiveAvatar LITE ($0,10)')}
        {modeBtn('did', 'D-ID foto ($0,40)')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Card label="Kostnad / min" value={`${costMin.toFixed(1)} kr`} />
        <Card label="Pris / min" value={`${Math.round(priceMin)} kr`} />
        <Card label="Faste kost / mnd" value={kr(fixedCost)} />
        <Card label="Inntekt / mnd" value={kr(rev)} />
        <Card label="Kostnad / mnd" value={kr(cost)} />
        <Card label="Fortjeneste / mnd" value={kr(profit)} />
      </div>

      <div style={{
        borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: ok ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.08)', border: `1px solid ${ok ? '#16a34a' : '#dc2626'}`,
      }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Samlet påslag (mål: ≥ 100 %)</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: ok ? '#16a34a' : '#dc2626' }}>{Math.round(mk)} %</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: ok ? '#16a34a' : '#dc2626' }}>
          {ok ? '✓ Oppfyller ≥100 %' : 'Under 100 % — øk pris'}
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginTop: 16 }}>
        Faste kostnader = custom avatar (${av}, video-avatar-slot hos LiveAvatar) + PVC-slot (ElevenLabs).
        Per-minutt = render ({mode === 'full' ? 'LiveAvatar FULL $0,20' : mode === 'lite' ? 'LiveAvatar LITE $0,10' : 'D-ID foto $0,40'}) + ElevenLabs TTS ($0,05) + Claude ($0,005).
        «Fast pris til megler» er det du tar per måned i tillegg til per-minutt-bruken.
      </p>
    </div>
  )
}
