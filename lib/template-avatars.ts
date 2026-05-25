const R2 = 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/template-avatars'
const P  = 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/presets'

export interface TemplateAvatar {
  id:          string
  name:        string
  desc:        string
  voiceId:     string
  portraitUrl: string
  presets:     { key: string; label: string; url: string }[]
}

export const TEMPLATE_AVATARS: TemplateAvatar[] = [
  {
    id: 'sofia', name: 'Sofia', desc: 'Varm og profesjonell', voiceId: 'uNsWM1StCcpydKYOjKyu', portraitUrl: `${R2}/sofia.jpg`,
    presets: [
      { key: 'modern_home',  label: 'Moderne hjem', url: `${P}/sofia_modern_home.png`  },
      { key: 'office',       label: 'Kontor',       url: `${P}/sofia_office.png`       },
      { key: 'studio',       label: 'Studio',       url: `${P}/sofia_studio.png`       },
      { key: 'neighborhood', label: 'Nabolag',      url: `${P}/sofia_neighborhood.png` },
    ],
  },
  {
    id: 'marius', name: 'Marius', desc: 'Klar og selvsikker', voiceId: 's2xtA7B2CTXPPlJzch1v', portraitUrl: `${R2}/marius.jpg`,
    presets: [
      { key: 'modern_home',  label: 'Moderne hjem', url: `${P}/marius_modern_home.png`  },
      { key: 'office',       label: 'Kontor',       url: `${P}/marius_office.png`       },
      { key: 'studio',       label: 'Studio',       url: `${P}/marius_studio.png`       },
      { key: 'neighborhood', label: 'Nabolag',      url: `${P}/marius_neighborhood.png` },
    ],
  },
  {
    id: 'ingrid', name: 'Ingrid', desc: 'Nordisk og elegant', voiceId: 'cgSgspJ2msm6clMCkdW9', portraitUrl: `${R2}/ingrid.jpg`,
    presets: [
      { key: 'modern_home',  label: 'Moderne hjem', url: `${P}/ingrid_modern_home.png`  },
      { key: 'office',       label: 'Kontor',       url: `${P}/ingrid_office.png`       },
      { key: 'studio',       label: 'Studio',       url: `${P}/ingrid_studio.png`       },
      { key: 'neighborhood', label: 'Nabolag',      url: `${P}/ingrid_neighborhood.png` },
    ],
  },
  {
    id: 'even', name: 'Even', desc: 'Rolig og trygg', voiceId: 'vUmLiNBm6MDcy1NUHaVr', portraitUrl: `${R2}/even.jpg`,
    presets: [
      { key: 'modern_home',  label: 'Moderne hjem', url: `${P}/even_modern_home.png`  },
      { key: 'office',       label: 'Kontor',       url: `${P}/even_office.png`       },
      { key: 'studio',       label: 'Studio',       url: `${P}/even_studio.png`       },
      { key: 'neighborhood', label: 'Nabolag',      url: `${P}/even_neighborhood.png` },
    ],
  },
  {
    id: 'hanna', name: 'Hanna', desc: 'Engasjert og moderne', voiceId: 'jsCqWAovK2LkecY7zXl4', portraitUrl: `${R2}/hanna.jpg`,
    presets: [
      { key: 'modern_home',  label: 'Moderne hjem', url: `${P}/hanna_modern_home.png`  },
      { key: 'office',       label: 'Kontor',       url: `${P}/hanna_office.png`       },
      { key: 'studio',       label: 'Studio',       url: `${P}/hanna_studio.png`       },
      { key: 'neighborhood', label: 'Nabolag',      url: `${P}/hanna_neighborhood.png` },
    ],
  },
  {
    id: 'erik', name: 'Erik', desc: 'Erfaren og grundig', voiceId: 'nhvaqgRyAq6BmFs3WcdX', portraitUrl: `${R2}/erik.jpg`,
    presets: [
      { key: 'modern_home',  label: 'Moderne hjem', url: `${P}/erik_modern_home.png`  },
      { key: 'office',       label: 'Kontor',       url: `${P}/erik_office.png`       },
      { key: 'studio',       label: 'Studio',       url: `${P}/erik_studio.png`       },
      { key: 'neighborhood', label: 'Nabolag',      url: `${P}/erik_neighborhood.png` },
    ],
  },
]
