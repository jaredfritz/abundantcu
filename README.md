# Abundant CU Web Platform

Launch-ready site for Abundant CU, built with Next.js + Tailwind and a reused Champaign zoning map module.

## Implemented Launch Scope

- `/` home page with:
  - Swiss minimalist style tokens
  - home map preview widget
  - mission pillars
  - sticky primary CTA for email signup
- `/zoning` full interactive zoning + permits map (reused from previous app)
- `/writings` publication card list (seed data + Sanity-ready loader)
- `/action` with CUrbanism first, Sway second, then resources
- global navbar/footer with repeated signup form
- lightweight lead capture API (`/api/lead`) with:
  - honeypot spam check
  - simple in-memory rate limiting
  - Google Sheets webhook submission
  - optional owner notification webhook

## Development

```bash
npm run dev
```

## High-Res Map Export Tool

Generate square, print-ready PNG exports for:

- zoning districts
- residential permit map
- where can I build a single family home
- where can I build a duplex
- where can I build a cafe

The exporter keeps identical map extent across all 5 outputs, adds a configurable border (default 10%), and boosts major-road labels for better print readability.

1. Install dependencies (includes Playwright):

```bash
npm install
npx playwright install chromium
```

2. (Optional) Copy and customize the config:

```bash
cp scripts/map-print.config.example.json scripts/map-print.config.json
```

3. Run export:

```bash
npm run export:maps -- --config=scripts/map-print.config.json
```

Output defaults to `exports/map-prints/`.

Use the frontend editor at `/data/zoning/studio` to visually tune styles and legend layout, then download a `map-print.config.json` file for the CLI exporter.
The studio includes legend placement presets (`top left`, `top right`, `bottom left`, `bottom right`, `single line bottom`, `centered`).
Studio export buttons support:

- `Download Current PNG` (one map at a time)
- `Download All 5 PNGs` (all variants)
- custom export resolution via `Export Size (px)` and `DPR`

`/data/zoning/studio` and `/data/zoning/print` are marked `noindex` and disallowed in `robots.txt` to avoid search indexing.

### Style + Legend Controls

You can customize:

- overlay recoloring via `style.zoningColors`, `style.buildColors`, `style.permitColors`
- permit point sizing via `style.permitSizeScale`
- legend inclusion/editing via `legend` and per-map `variants.<id>.legend`
- legend position/size via `xPct`, `yPct`, `widthPct`, `scale`
- legend item text/colors/shapes via `legend.items`

Variant IDs:

- `zoning`
- `permits`
- `build-sfh`
- `build-duplex`
- `build-cafe`

## Environment Setup

Copy `.env.example` to `.env.local` and set values:

- `GOOGLE_SHEETS_WEBHOOK_URL` is required for form submission storage.
- `OWNER_EMAIL_WEBHOOK_URL` is optional.
- `SANITY_*` values are optional. If unset, writings use local seed data.
- For scheduled Supabase keepalive on Vercel, set `CRON_SECRET`.

## Supabase Keepalive Cron

To reduce risk of Supabase auto-pausing due inactivity, a scheduled endpoint is included:

- API route: `/api/supabase-keepalive`
- Scheduler: `vercel.json` cron every 6 hours
- Protection: requires `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set

Vercel automatically attaches that authorization header to cron invocations when `CRON_SECRET` is configured.

## Notes

- The original map app is preserved separately and reused here.
- This launch intentionally keeps analytics and lead infrastructure light.
