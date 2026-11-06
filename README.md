# Abundant CU

The source for [abundantcu.com](https://www.abundantcu.com): maps, datasets, and policy tools about land use and
housing in Champaign-Urbana, Illinois, plus practical tools for using city services. Built with Next.js, React, Tailwind, and MapLibre.

## What's here

| Page | What it shows | Data |
|---|---|---|
| `/data/crashes` | Every reported crash in Champaign, Urbana, and Savoy since 2014, with a location report builder | IDOT crash data, CCRPC fields |
| `/data/value-per-acre` | Property value and tax per acre for every parcel in Champaign County | County parcels and assessments, County Clerk tax rates |
| `/data/vacant-land` | Vacant parcels by type, including land held with the house next door | Same as above |
| `/data/zoning` | Zoning by parcel, residential permits since 2014, and where common housing types are allowed | City of Champaign zoning, permits, and address points; county parcels |
| `/data/yard-waste` | City of Champaign yard waste zones and pickup dates by address, with a calendar download and email reminders | City of Champaign Public Works map services |
| `/data/parking` | Community-mapped parking lots and garages downtown | Supabase (live, contributor-drawn) |

Each page's "About this data" section explains its sources, methods, and caveats.

`/adopt-a-drain` is a front end on the City of Champaign's Adopt-a-Drain program. It reads and writes the City's
ArcGIS drain layer and uses the City's sign-in service (`AuthGP`), which emails volunteers a link back to this page;
see `src/lib/adoptADrain.server.ts`. It needs no keys. Edits are checked server-side: the City's sign-in token must
validate, and only a drain's adopter can release, rename, or mark it cleaned. It isn't part of the public data tools.

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
| Yard waste reminders | Supabase (sign-ups), Resend (email), and Vercel Cron (daily send) | The page offers a calendar download and the city's notification emails instead |
| Scheduled jobs | Vercel Cron (`vercel.json`) | Call `/api/supabase-keepalive` from any scheduler, or skip it |

Basemaps on the data maps are CARTO's free Positron style with OpenStreetMap data, loaded from CARTO's CDN; swap
`CRASH_BASEMAP` and `PARCEL_BASEMAP` in `src/lib/*MapStyles.ts` for another MapLibre style if you prefer.

## Public data tools

The `/data` tools are published as open source in a separate public repository,
[jaredfritz/cu-data-tools](https://github.com/jaredfritz/cu-data-tools); this repository (the full site) stays private.

**Build here first.** New tools and changes to existing ones are developed, reviewed, and shipped in this repository.
Whether and when a change goes to `cu-data-tools` is a separate decision, made after it's live on the site. Never edit
`cu-data-tools` directly; it's only ever updated by the export below. Keeping `public-tools/` and the export script in
step with a change (so a later export works) is fine, but don't run the export or push to `cu-data-tools` unless asked.

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
signup, writings, editor admin, and yard waste email reminders aren't exported (`public-tools/` replaces the reminder
form with a link to the city's notification emails). `LICENSE` is the MIT license the
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
- What it does: reads one row from `parking_features` with the anon key. It has to be a real database query: the auth
  settings and REST root endpoints answer from config and cache, so pinging only those let the project pause anyway.

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

## Yard Waste Data

`/data/yard-waste` shows the City of Champaign's yard waste collection zones and pickup dates, from the Public Works
map services behind the city's
[Yard Waste Collection map](https://experience.arcgis.com/experience/8133ffc42b9741aea6e9a1f3d49b7a4f):

```bash
npm run data:yard-waste
```

The city keeps one service for fall and one for spring, with each zone's dates as text ("Mondays: Oct 26, Nov 9,
Nov 30") and no year. The script works out the year from the weekdays, keeps the season that is under way or coming up
next, and writes `src/data/yard-waste.json`. It stops with the text it couldn't read if the city changes the format.
The **Refresh yard waste data** GitHub Action (`.github/workflows/refresh-yard-waste.yml`) runs weekly and opens a pull
request when the city's zones or dates change.

### Add to calendar

After a search, people can add the current season's remaining pickups to a calendar. Each pickup becomes a "Put yard
waste at the curb" event from 6:00 to 6:30 p.m. the evening before (bags must be out by 6 a.m.), so calendars give their
usual timed reminder: Google applies the person's default, and the calendar file includes an alert for Apple Calendar
and Outlook. The button guesses the calendar from the device: Apple devices add every remaining pickup to Apple
Calendar in one tap (a calendar file from `/api/yard-waste/calendar?zone=O-5[&date=YYYY-MM-DD]`), Android opens Google
Calendar, and other devices get a menu. "Use a different calendar" offers Google, Outlook.com, and Microsoft 365 links
(one pickup each) and the all-at-once file. These are one-time events; nothing subscribes, so later schedule changes
can't silently go wrong in someone's calendar.

When every pickup of the season has passed, the page says so, keeps the zones and dates for reference, and hides the
calendar and reminder options until the next season's data is merged.

### Email reminders

People can sign up on the page for an email a chosen number of days (1 to 7) before each of the **current season's**
remaining pickups. Each sign-up records its season (`season`, e.g. `fall-2026`), and the daily job only sends for the
season the site's data covers, so reminders stop when the season ends. An optional, unchecked box ("Email me when
reminders open for future seasons") sets `future_updates`; those are the only people to contact about a later season.
Unsubscribing clears it. To turn reminders on:

1. Run `supabase/yard_waste_reminders_schema.sql` in the Supabase SQL editor.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (a sender on a
   domain verified in Resend), `NEXT_PUBLIC_BASE_URL`, and `CRON_SECRET`, then redeploy (the page checks at build time).

Sign-ups are double opt-in: the API (`/api/yard-waste/reminders`) checks Turnstile and rate limits, finds the zone from
the geocoded address, and emails a confirmation link. Nothing else is sent until the person clicks Confirm on
`/data/yard-waste/reminders`. Vercel Cron calls `/api/yard-waste/reminders/send` daily at 21:13 UTC (3 or 4 p.m. in
Champaign); it sends each reminder whose next pickup is within its lead time and records it in
`yard_waste_reminder_sends`, so a pickup is reminded once even if the job runs again, and a missed day catches up.
Zones are looked up from each sign-up's saved location at send time. Every reminder has an unsubscribe link and one-click `List-Unsubscribe` headers.

## Data dates on the maps

Each map and dashboard under `/data` shows what its data covers and when it was last refreshed (for example,
"Crashes through Dec 31, 2025 · Refreshed Oct 4, 2026"), from `src/data/data-updates.json`. `npm run data:parcels`
and `npm run data:crashes` write their entries from the data they build (crashes only when the data actually
changes), as does `npm run data:yard-waste` (only when the schedule changes). Zoning is a static file: update its `asOf` date by hand when it changes. The permit year comes from the
permit data itself, and the parking map shows its most recent community addition from the live data.
