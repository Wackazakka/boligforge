import type { MetadataRoute } from 'next'

// Bevisst kort: bare de sidene som faktisk er offentlige og ment for
// meglere som allerede er sendt hit. Ingen dashboard-, POC- eller testruter.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://reelhome.ai'
  return [
    { url: `${base}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/bli-selger`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
