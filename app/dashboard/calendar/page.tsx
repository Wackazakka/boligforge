'use client'

import { useEffect, useState } from 'react'

type Connection = {
  id: string
  platform: string
  page_name: string
}

type ScheduledRow = {
  id: string
  property_id: string | null
  video_url: string
  caption: string | null
  connection_ids: string[]
  scheduled_at: string
}

type PublicationRow = {
  id: string
  property_id: string | null
  platform: string
  page_name: string | null
  caption: string | null
  status: string
  created_at: string
}

type CalendarEntry = {
  id: string
  platform: string
  pageName: string
  status: 'scheduled' | 'published' | 'failed'
  caption: string | null
  date: string
  isScheduled: boolean
}

const PLATFORMS = ['Alle', 'facebook', 'linkedin']
const STATUSES: ('Alle' | 'scheduled' | 'published' | 'failed')[] = ['Alle', 'scheduled', 'published', 'failed']

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Planlagt',   color: '#2563eb', bg: '#dbeafe' },
  published: { label: 'Publisert',  color: '#166534', bg: '#dcfce7' },
  failed:    { label: 'Feilet',     color: '#991b1b', bg: '#fee2e2' },
}

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
}

function Badge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: 'var(--muted)', bg: 'var(--surface-2)' }
  return (
    <span style={{
      padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
      background: meta.bg, color: meta.color,
    }}>
      {meta.label}
    </span>
  )
}

export default function CalendarPage() {
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState('Alle')
  const [statusFilter, setStatusFilter] = useState<'Alle' | 'scheduled' | 'published' | 'failed'>('Alle')
  const [view, setView] = useState<'table' | 'calendar'>('table')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  async function load() {
    setLoading(true)
    try {
      const [connRes, schedRes, pubRes] = await Promise.all([
        fetch('/api/social/connections'),
        fetch('/api/social/schedule'),
        fetch('/api/social/publications'),
      ])

      const connections: Connection[] = connRes.ok ? await connRes.json() : []
      const scheduled:   ScheduledRow[] = schedRes.ok ? await schedRes.json() : []
      const published:   PublicationRow[] = pubRes.ok ? await pubRes.json() : []

      const connMap = new Map(connections.map(c => [c.id, c]))

      // Each scheduled row may target multiple connections — expand into one
      // calendar entry per platform/account.
      const scheduledEntries: CalendarEntry[] = scheduled.flatMap(s =>
        (s.connection_ids.length ? s.connection_ids : ['none']).map(cid => {
          const conn = connMap.get(cid)
          // id encodes the scheduled-row id (before the colon) so we can
          // delete the whole scheduled row when cancelling any of its entries.
          return {
            id:          `${s.id}:${cid}`,
            platform:    conn?.platform ?? 'ukjent',
            pageName:    conn?.page_name ?? 'Ukjent konto',
            status:      'scheduled' as const,
            caption:     s.caption,
            date:        s.scheduled_at,
            isScheduled: true,
          }
        })
      )

      const publishedEntries: CalendarEntry[] = published.map(p => ({
        id:         p.id,
        platform:   p.platform,
        pageName:   p.page_name ?? PLATFORM_LABEL[p.platform] ?? p.platform,
        status:     (p.status === 'failed' ? 'failed' : 'published') as CalendarEntry['status'],
        caption:    p.caption,
        date:       p.created_at,
        isScheduled: false,
      }))

      setEntries([...scheduledEntries, ...publishedEntries])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(entry: CalendarEntry) {
    if (!entry.isScheduled) return
    const schedId = entry.id.split(':')[0]
    setDeleting(entry.id)
    try {
      await fetch('/api/social/schedule', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: schedId }),
      })
      // Remove every entry that came from this scheduled row
      setEntries(prev => prev.filter(e => !(e.isScheduled && e.id.startsWith(`${schedId}:`))))
    } finally {
      setDeleting(null)
    }
  }

  const filtered = entries.filter(e => {
    if (platformFilter !== 'Alle' && e.platform !== platformFilter) return false
    if (statusFilter !== 'Alle' && e.status !== statusFilter) return false
    return true
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Calendar helpers
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthLabel = currentMonth.toLocaleString('nb-NO', { month: 'long', year: 'numeric' })

  function entriesForDay(day: number) {
    return filtered.filter(e => {
      const d = new Date(e.date)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  const selectStyle: React.CSSProperties = {
    fontSize: '14px', borderRadius: '8px', padding: '6px 10px',
    border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)',
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
          Publiseringskalender
        </h1>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['table', 'calendar'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                cursor: 'pointer', border: '1px solid var(--line)',
                background: view === v ? 'var(--ink)' : 'var(--surface)',
                color:      view === v ? '#fff' : 'var(--muted)',
              }}
            >
              {v === 'table' ? 'Liste' : 'Kalender'}
            </button>
          ))}
        </div>
      </div>
      <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px' }}>
        Planlagte og publiserte videoer på tvers av dine sosiale kontoer.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Plattform</label>
          <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} style={selectStyle}>
            {PLATFORMS.map(p => <option key={p} value={p}>{p === 'Alle' ? 'Alle' : (PLATFORM_LABEL[p] ?? p)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={selectStyle}>
            {STATUSES.map(s => <option key={s} value={s}>{s === 'Alle' ? 'Alle' : STATUS_META[s]?.label ?? s}</option>)}
          </select>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--muted-2)', paddingBottom: '7px' }}>
          {filtered.length} {filtered.length === 1 ? 'innlegg' : 'innlegg'}
        </span>
      </div>

      {loading ? (
        <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Laster…</p>
      ) : filtered.length === 0 ? (
        <div className="app-card" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Ingen planlagte eller publiserte innlegg ennå.</p>
        </div>
      ) : view === 'table' ? (
        <div className="app-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                {['Tidspunkt', 'Plattform', 'Konto', 'Status', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--muted)', fontSize: '12px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr key={entry.id} style={{ borderTop: i > 0 ? '1px solid var(--line)' : undefined }}>
                  <td style={{ padding: '12px 16px', color: 'var(--ink)' }}>
                    {new Date(entry.date).toLocaleString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--ink)' }}>{PLATFORM_LABEL[entry.platform] ?? entry.platform}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{entry.pageName}</td>
                  <td style={{ padding: '12px 16px' }}><Badge status={entry.status} /></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {entry.isScheduled && (
                      <button
                        onClick={() => handleDelete(entry)}
                        disabled={deleting === entry.id}
                        style={{
                          fontSize: '12px', color: '#dc2626', background: '#fee2e2',
                          border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px',
                        }}
                      >
                        {deleting === entry.id ? '…' : 'Avbryt'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Calendar view */
        <div className="app-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
            <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} style={{ fontSize: '18px', padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>‹</button>
            <span style={{ fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize' }}>{monthLabel}</span>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} style={{ fontSize: '18px', padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 500, padding: '8px 0', color: 'var(--muted-2)', borderBottom: '1px solid var(--line)' }}>{d}</div>
            ))}
            {Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }).map((_, i) => (
              <div key={`empty-${i}`} style={{ borderBottom: '1px solid var(--line)', borderRight: '1px solid var(--line)', minHeight: 76 }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayEntries = entriesForDay(day)
              const now = new Date()
              const isToday = now.getDate() === day && now.getMonth() === month && now.getFullYear() === year
              return (
                <div key={day} style={{ padding: '4px', borderBottom: '1px solid var(--line)', borderRight: '1px solid var(--line)', minHeight: 76 }}>
                  <div style={{
                    fontSize: '12px', fontWeight: 500, width: 24, height: 24, marginBottom: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '999px',
                    background: isToday ? 'var(--ink)' : 'transparent',
                    color:      isToday ? '#fff' : 'var(--muted)',
                  }}>
                    {day}
                  </div>
                  {dayEntries.slice(0, 3).map(e => {
                    const meta = STATUS_META[e.status]
                    return (
                      <div key={e.id} style={{
                        fontSize: '11px', padding: '1px 6px', borderRadius: '4px', marginBottom: 2,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        background: meta?.bg, color: meta?.color,
                      }}>
                        {PLATFORM_LABEL[e.platform] ?? e.platform}
                      </div>
                    )
                  })}
                  {dayEntries.length > 3 && (
                    <div style={{ fontSize: '11px', color: 'var(--muted-2)' }}>+{dayEntries.length - 3} til</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
