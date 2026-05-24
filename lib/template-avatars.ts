const R2 = 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/template-avatars'

export interface TemplateAvatar {
  id:          string
  name:        string
  desc:        string
  voiceId:     string
  portraitUrl: string
}

export const TEMPLATE_AVATARS: TemplateAvatar[] = [
  { id: 'sofia',  name: 'Sofia',  desc: 'Varm og profesjonell', voiceId: 'uNsWM1StCcpydKYOjKyu', portraitUrl: `${R2}/sofia.jpg`  },
  { id: 'marius', name: 'Marius', desc: 'Klar og selvsikker',   voiceId: 's2xtA7B2CTXPPlJzch1v', portraitUrl: `${R2}/marius.jpg` },
  { id: 'ingrid', name: 'Ingrid', desc: 'Nordisk og elegant',   voiceId: 'cgSgspJ2msm6clMCkdW9', portraitUrl: `${R2}/ingrid.jpg` },
  { id: 'even',   name: 'Even',   desc: 'Rolig og trygg',       voiceId: 'vUmLiNBm6MDcy1NUHaVr', portraitUrl: `${R2}/even.jpg`   },
  { id: 'hanna',  name: 'Hanna',  desc: 'Engasjert og moderne', voiceId: 'jsCqWAovK2LkecY7zXl4', portraitUrl: `${R2}/hanna.jpg`  },
  { id: 'erik',   name: 'Erik',   desc: 'Erfaren og grundig',   voiceId: 'nhvaqgRyAq6BmFs3WcdX', portraitUrl: `${R2}/erik.jpg`   },
]
