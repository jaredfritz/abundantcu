import type { NextConfig } from "next";

// Report-only for now. Hosts each directive needs:
// - MapLibre maps: CARTO's style, sprites and fonts (basemaps.cartocdn.com) and vector tiles
//   (tiles.basemaps.cartocdn.com), and a blob: worker that MapLibre creates to draw the map.
// - Parking map: the Google Maps JavaScript API, from the hosts Google's CSP guide lists.
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://maps.gstatic.com https://challenges.cloudflare.com https://vitals.vercel-insights.com https://basemaps.cartocdn.com https://tiles.basemaps.cartocdn.com https://nominatim.openstreetmap.org",
  "worker-src 'self' blob:",
  "frame-src 'self' https://challenges.cloudflare.com",
].join("; ");

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/map-export": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/parking-map-export": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
        ],
      },
    ];
  },
};

export default nextConfig;
