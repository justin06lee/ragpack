import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://ragpack.top" as const;
  return [
    {
      url: `${base}/`,
      changeFrequency: "weekly",
      lastModified: new Date(),
      priority: 1,
    },
  ];
}


