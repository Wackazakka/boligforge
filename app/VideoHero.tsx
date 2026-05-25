'use client';

import { useRef, useState } from 'react';

const VIDEO_SRC =
  'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/videos/9ece16b4-fa71-417e-9704-ee5bda46d86f/output.mp4';

export default function VideoHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  function toggleMute() {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setMuted(videoRef.current.muted);
  }

  return (
    <div className="pf-video">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <button
        className={`pf-sound${muted ? '' : ' on'}`}
        onClick={toggleMute}
        aria-label={muted ? 'Skru på lyd' : 'Skru av lyd'}
        style={{
          position: 'absolute',
          bottom: 14,
          right: 14,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.25)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
        }}
      >
        {muted ? (
          /* speaker off */
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          /* speaker on */
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
      </button>
    </div>
  );
}
