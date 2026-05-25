'use client'

import { useState } from 'react'

export default function TopupBanner({ remaining }: { remaining: number }) {
  const [loading, setLoading] = useState(false)

  async function handleTopup() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/topup', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: remaining === 0 ? '#fef2f2' : '#fffbeb',
      border: `1px solid ${remaining === 0 ? '#fca5a5' : '#fcd34d'}`,
      borderRadius: '10px',
      padding: '14px 20px',
      marginBottom: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
    }}>
      <p style={{ fontSize: '14px', color: remaining === 0 ? '#991b1b' : '#92400e', margin: 0 }}>
        {remaining === 0
          ? '🎬 Du har ingen videoer igjen denne måneden.'
          : `🎬 Du har bare ${remaining} video igjen denne måneden.`}
        {' '}Trenger du mer?
      </p>
      <button
        onClick={handleTopup}
        disabled={loading}
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#fff',
          background: remaining === 0 ? '#dc2626' : '#d97706',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 16px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? 'Venter…' : 'Kjøp topup'}
      </button>
    </div>
  )
}
