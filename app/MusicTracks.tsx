'use client'

import { useRef, useState } from 'react'

type Track = {
  name: string
  meta: string
  dur: string
  src: string | null  // null = ikke klart ennå → vises som "Snart"
}

// Legg til src-URL når nye spor er produsert — resten skjer automatisk
const TRACKS: Track[] = [
  {
    name: 'Nordlys',
    meta: 'Ambient · Strykere · 80 BPM',
    dur: '02:42',
    src: 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/music/1779358388960_reforhandle.mp3',
  },
  {
    name: 'Fjorden Stiger',
    meta: 'Cinematic · Piano · 92 BPM',
    dur: '03:18',
    src: null,
  },
  {
    name: 'Mørketid',
    meta: 'Lavmælt · Akustisk · 68 BPM',
    dur: '02:05',
    src: null,
  },
]

export default function MusicTracks() {
  const [playing, setPlaying] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function toggle(src: string) {
    if (playing === src) {
      audioRef.current?.pause()
      setPlaying(null)
    } else {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      const a = new Audio(src)
      audioRef.current = a
      a.play().catch(() => {})
      a.onended = () => setPlaying(null)
      setPlaying(src)
    }
  }

  return (
    <div className="tracks">
      {TRACKS.map(t => (
        <div
          key={t.name}
          className={`track${t.src ? ' on' : ' soon'}`}
          onClick={t.src ? () => toggle(t.src!) : undefined}
          style={{ cursor: t.src ? 'pointer' : 'default', opacity: t.src ? 1 : 0.45 }}
        >
          <span className="play" style={t.src && playing === t.src ? { background: 'var(--gold)', opacity: 1 } : {}}>
            {t.src && playing === t.src
              ? <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            }
          </span>
          <span className="info">
            <span className="n">{t.name}</span>
            <span className="m">{t.src ? t.meta : 'Produseres'}</span>
          </span>
          {t.src
            ? <span className="dur">{t.dur}</span>
            : <span className="dur" style={{ fontSize: '9px', opacity: 0.6 }}>Snart</span>
          }
        </div>
      ))}
    </div>
  )
}
