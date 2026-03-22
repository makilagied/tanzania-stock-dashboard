import type { MetadataRoute } from "next"

const SITE = "https://www.uwekezaji.online"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: SITE,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE}/funds`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ]
}
