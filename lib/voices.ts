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

/** Ferdige lydklipp vi allerede har — gratis avspilling, slipper TTS-kall. */
const PREVIEW: Record<string, string> = {
  nhvaqgRyAq6BmFs3WcdX: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/7dc5c03caf8f40daa575fa9eacbf3de8/voices/nhvaqgRyAq6BmFs3WcdX/Z8yVliHOyn9eSmt4YEVw.mp3',
  s2xtA7B2CTXPPlJzch1v: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/15af1c0d0dcd479cb8376a767ab07b4c/voices/s2xtA7B2CTXPPlJzch1v/YB9DE4weRg6BTei8hVZ5.mp3',
  '2dhHLsmg0MVma2t041qT': 'https://storage.googleapis.com/eleven-public-prod/custom/voices/2dhHLsmg0MVma2t041qT/fX3l7ljt7bx6zRPz8VdC.mp3',
  BGEU6wFi2uNm6Kje1Yhk: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/ed9b05e6324c457685490352e9a1ec90/voices/BGEU6wFi2uNm6Kje1Yhk/gCIHS9pPkrtwiAjN4VgG.mp3',
  CMbvLbbccSd611KtwxV3: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/2461cf568dc042a3bbfbf75522203b35/voices/CMbvLbbccSd611KtwxV3/fabf86a6-90db-42c2-9993-47fff3f73a80.mp3',
  vUmLiNBm6MDcy1NUHaVr: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/3690d7df74c84d8880e0e0d0641de7f2/voices/vUmLiNBm6MDcy1NUHaVr/6JBvRVvXcssLtXlaqLg1.mp3',
  uNsWM1StCcpydKYOjKyu: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/a2175a4ce5a74c88868dd9d4a000c9a6/voices/uNsWM1StCcpydKYOjKyu/868f87d5-7724-4786-a7fa-a48e01b2ba54.mp3',
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
