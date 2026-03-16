import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/data/zoning/studio", "/data/zoning/print"],
    },
    sitemap: "https://abundantcu.com/sitemap.xml",
  };
}
