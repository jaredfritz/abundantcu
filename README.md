# Abundant CU

The source for [abundantcu.com](https://www.abundantcu.com): maps, datasets, and policy tools about land use and
housing in Champaign-Urbana, Illinois. Built with Next.js, React, Tailwind, and MapLibre.

## What's here

| Page | What it shows | Data |
|---|---|---|
| `/data/crashes` | Every reported crash in Champaign, Urbana, and Savoy since 2014, with a location report builder | IDOT crash data, CCRPC fields |
| `/data/value-per-acre` | Property value and tax per acre for every parcel in Champaign County | County parcels and assessments, County Clerk tax rates |
| `/data/vacant-land` | Vacant parcels by type, including land held with the house next door | Same as above |
| `/data/zoning` | Zoning districts, residential permits since 2014, and where common housing types are allowed | City of Champaign zoning, permits, and address points |
| `/data/city-map` | Every City of Champaign zoning layer and district boundary over county parcels, with a click-anywhere lookup | City of Champaign Open Data layers (`npm run data:city-layers`), county parcels |
| `/data/parking` | Community-mapped parking lots and garages downtown | Supabase (live, contributor-drawn) |

Each page's "About this data" section explains its sources, methods, and caveats.

## Quick start

```bash
npm install
npm run dev
```

No accounts or API keys are needed. With no environment variables set, every `/data` map except the parking map
works, address search uses OpenStreetMap's Nominatim, and writings use local seed data.

## Optional services

The live site uses these hosted services. All are optional; see `.env.example` for the variables.

| Feature | Service | Without it |
|---|---|---|
| Address search | Google Geocoding and Places | Falls back to OpenStreetMap Nominatim (set `NOMINATIM_USER_AGENT` to your own app and contact) |
| Parking map | Supabase (data and editor sign-in) and Google Maps JavaScript API | Page shows a "not configured" notice |
| Email signup | A webhook (e.g. Google Apps Script to a Sheet) and Cloudflare Turnstile | Signups report that they aren't set up |
| Editor access emails | Resend or a webhook | Requests are still saved to Supabase, but no email is sent |
| Writings | Sanity | Local seed data in `src/data/writings.seed.ts` |
| Shared rate limiting | Upstash Redis | In-memory rate limiting per server instance |
| Scheduled jobs | Vercel Cron (`vercel.json`) | Call `/api/supabase-keepalive` from any scheduler, or skip it |

Basemaps on the data maps are CARTO's free Positron style with OpenStreetMap data, loaded from CARTO's CDN; swap
`CRASH_BASEMAP` and `PARCEL_BASEMAP` in `src/lib/*MapStyles.ts` for another MapLibre style if you prefer.

## Public data tools

The `/data` tools are published as open source in a separate public repository,
[jaredfritz/cu-data-tools](https://github.com/jaredfritz/cu-data-tools); this repository (the full site) stays private.
To publish changes to the tools:

```bash
git clone https://github.com/jaredfritz/cu-data-tools ../cu-data-tools   # once
npm run export:public -- ../cu-data-tools
cd ../cu-data-tools && npm install && npm run build                      # check it stands alone
git add -A && git commit -m "Update from site" && git push
```

`scripts/export-public-tools.mjs` follows imports from each tool's page, API route, and data script, so the file list
updates itself. `public-tools/` holds the files that differ in the public repo (README, package.json, a plain page
shell and index, config), and `REWRITES` in the script adjusts lines that name or link the site. The parking map,
signup, writings, and editor admin aren't exported. `LICENSE` is the MIT license the
public repo uses.

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

Copy `.env.example` to `.env.local` and set the values you use. Every variable is optional; the comments in
`.env.example` say what each one turns on.

## Supabase Keepalive Cron

To reduce risk of Supabase auto-pausing due inactivity, a scheduled endpoint is included:

- API route: `/api/supabase-keepalive`
- Scheduler: `vercel.json` cron, daily at 08:00 UTC
- Protection: requires `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set

Vercel automatically attaches that authorization header to cron invocations when `CRON_SECRET` is configured.

## Crash Dashboard Data

`/data/crashes` (dashboard) and `/data/crashes/location-report` load a static file of crashes in Champaign, Urbana, and Savoy
built from IDOT's yearly statewide crash layers (https://gis-idot.opendata.arcgis.com), plus Census municipal
boundaries:

```bash
npm run data:crashes                     # all available years, 2014 on
npm run data:crashes -- --from=2020 --to=2025
npm run data:crashes -- --refresh-ccrpc  # also re-download CCRPC's crash points
```

The script also adds heavy-vehicle and University District fields for the years covered by CCRPC's
[Champaign County Traffic Crash Dashboard](https://crashdashboard.ccrpc.org/) (currently 2020-2024), matching
CCRPC's crash points to IDOT records by year, city, injuries, crash type, cause, and location
(`scripts/ccrpc-supplement.mjs`). CCRPC's points are kept in a saved copy, `data/ccrpc/crash-points.json`, so
normal builds never contact CCRPC; `--refresh-ccrpc` updates that copy (keeping the old one if the download fails).

The **Refresh crash data** GitHub Action (`.github/workflows/refresh-crash-data.yml`) runs on the 3rd of each month,
or on demand from the Actions tab. It re-downloads IDOT's data and CCRPC's snapshot and opens a pull request only if
something changed. It needs "Allow GitHub Actions to create and approve pull requests" turned on under
Settings → Actions → General.

Output goes to `public/data/crashes/`. The pages are adapted from the MIT-licensed
[Chicago Crash Dashboard](https://github.com/MisterClean/chicago-crashes-pipeline); see
`src/components/crashes/LICENSE-chicago-crash-dashboard.txt`.

## Value Per Acre Data

`/data/value-per-acre` maps property value per acre for every parcel in Champaign County, with filters for each
municipality. `/data/vacant-land` maps vacant parcels by type from the same data file. It loads a static file built from:

- parcel boundaries and assessments: the City of Champaign's public `TaxParcels_Assessed` layer (Champaign County GIS
  Consortium data)
- tax rates by tax code, and each tax code's municipality: the Champaign County Clerk's latest rate book PDF
- site addresses: the county property tax inquiry's township search export (owner names are discarded)

Condo and townhome units, which the county maps as building footprints only, are combined into approximate development
areas (see `docs/value-per-acre-next-steps.md`). Refresh the data after new assessments or a new rate book are published
(takes about 3 minutes):

```bash
npm run data:parcels
npm run data:parcels -- --rate-book=<pdf url>   # pin a specific rate book
npm run data:parcels -- --skip-addresses
npm run data:parcels -- --cache=/tmp/parcel-cache   # reuse downloads while developing
```

In a proxied environment, run with `NODE_USE_ENV_PROXY=1` so Node's `fetch` uses the proxy.

Output goes to `public/data/parcels/`. The methodology is adapted from the MIT-licensed
[Strong Towns Chicago Value Per Acre map](https://github.com/StrongTownsChicago/chicago-value-per-acre); see
`src/components/parcels/LICENSE-chicago-value-per-acre.txt`. Planned follow-ups are in
`docs/value-per-acre-next-steps.md`.

## Residential Permit Data

The permit layer on `/data/zoning` comes from new-construction building permits provided by the City of Champaign,
kept in `data/permits/champaign-residential-permits.csv` (no coordinates). To add permits, append rows to the CSV and
rebuild the map points:

```bash
npm run data:permits
```

Each address is matched to the City of Champaign's public Address Points layer (including retired addresses), then
to the county site addresses in the parcel data, then placed between the nearest address points on the same side of
the same street. Street names a permit spells differently from the city go in `SPELLINGS` in the script. The script
lists any permits it can't place. Output goes to
`src/data/residential-permits.json`.

## Data dates on the maps

Each map and dashboard under `/data` shows what its data covers and when it was last refreshed (for example,
"Crashes through Dec 31, 2025 · Refreshed Oct 4, 2026"), from `src/data/data-updates.json`. `npm run data:parcels`
and `npm run data:crashes` write their entries from the data they build (crashes only when the data actually
changes). Zoning is a static file: update its `asOf` date by hand when it changes. The permit year comes from the
permit data itself, and the parking map shows its most recent community addition from the live data.
