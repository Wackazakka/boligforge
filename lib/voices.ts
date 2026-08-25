import { TEMPLATE_AVATARS } from './template-avatars'

/**
 * ÉN katalog over stemmene — én oppføring per stemme, ett navn per stemme.
 *
 * Før dette lå lista bare på profilsiden, og fire av sju oppføringer var i
 * virkeligheten malavatarenes stemmer under andre navn: «Mia» var Sofias
 * stemme, «Dennis» var Marius', «Helge» var Evens og «Øyvind» var Eriks.
 * Da så det ut som to uavhengige valg, mens man i praksis valgte det samme
 * to ganger — og valgte man «Øyvind» til Sofia, snakket Sofia med Eriks
 * stemme uten at noe sa fra.
 *
 * Nå bærer stemmen navnet til avataren den tilhører, og `avatarId` gjør
 * koblingen eksplisitt for UI-et.
 */
export type Voice = {
  id: string
  /** Vises i velgeren. Én stemme = ett navn. */
  name: string
  /** Ferdig lydklipp der vi har et. Mangler det, syntetiseres forhåndsvisningen. */
  preview?: string
  /** Satt når stemmen tilhører en av malavatarene. */
  avatarId?: string
}

/** Ferdige lydklipp — normalisert til -16 LUFS og lagt paa VAAR R2 (25/8), samme
 *  nivaa som «Hoer innlesing» og ferdig video, saa stemmer kan sammenlignes
 *  rettferdig. De raa ElevenLabs-CDN-klippene laa paa ~-27 LUFS. */
const PREVIEW: Record<string, string> = {
  nhvaqgRyAq6BmFs3WcdX: 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/voice-previews/nhvaqgRyAq6BmFs3WcdX.mp3',
  s2xtA7B2CTXPPlJzch1v: 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/voice-previews/s2xtA7B2CTXPPlJzch1v.mp3',
  '2dhHLsmg0MVma2t041qT': 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/voice-previews/2dhHLsmg0MVma2t041qT.mp3',
  BGEU6wFi2uNm6Kje1Yhk: 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/voice-previews/BGEU6wFi2uNm6Kje1Yhk.mp3',
  CMbvLbbccSd611KtwxV3: 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/voice-previews/CMbvLbbccSd611KtwxV3.mp3',
  vUmLiNBm6MDcy1NUHaVr: 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/voice-previews/vUmLiNBm6MDcy1NUHaVr.mp3',
  uNsWM1StCcpydKYOjKyu: 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/voice-previews/uNsWM1StCcpydKYOjKyu.mp3',
}

/** Stemmene som hører til en malavatar — utledet, så de aldri kan drive fra hverandre. */
const AVATAR_VOICES: Voice[] = TEMPLATE_AVATARS.map(a => ({
  id: a.voiceId,
  name: `${a.name} — avatarstemme`,
  preview: PREVIEW[a.voiceId],
  avatarId: a.id,
}))

/** Stemmer uten ansikt. Til deg som presenterer selv. */
const STANDALONE_VOICES: Voice[] = [
  { id: '2dhHLsmg0MVma2t041qT', name: 'Johannes — selvsikker', preview: PREVIEW['2dhHLsmg0MVma2t041qT'] },
  { id: 'BGEU6wFi2uNm6Kje1Yhk', name: 'Maja — nordisk, dramatisk', preview: PREVIEW.BGEU6wFi2uNm6Kje1Yhk },
  { id: 'CMbvLbbccSd611KtwxV3', name: 'Robert — Oslo', preview: PREVIEW.CMbvLbbccSd611KtwxV3 },
]

export const VOICES: Voice[] = [...AVATAR_VOICES, ...STANDALONE_VOICES]

export function voiceById(id?: string | null): Voice | undefined {
  return id ? VOICES.find(v => v.id === id) : undefined
}

/** Navnet vi viser for en stemme-id — også for en klonet stemme vi ikke har i katalogen. */
export function voiceLabel(id?: string | null, clonedVoiceId?: string | null): string {
  if (id && clonedVoiceId && id === clonedVoiceId) return 'Din egen stemme'
  return voiceById(id)?.name ?? 'Ingen stemme valgt'
}
