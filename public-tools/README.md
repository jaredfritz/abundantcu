# Champaign-Urbana Data Tools

Open-source maps and data pipelines for Champaign-Urbana, Illinois, originally built for
[Abundant CU](https://www.abundantcu.com). Fork them, check the methods, or adapt them for your own town.

| Page | What it shows |
|---|---|
| `/data/crashes` | Every reported traffic crash in Champaign, Urbana, and Savoy since 2014, with trends, a map, and costs |
| `/data/crashes/location-report` | A crash report for any city, street, or intersection |
| `/data/value-per-acre` | Property value and property tax per acre for every parcel in Champaign County, in 2D or 3D |
| `/data/vacant-land` | Vacant parcels by type, including subdivision land still assessed at farmland rates and lots held with the house next door |
| `/data/zoning` | City of Champaign zoning districts, residential permits since 2014, and where common housing types are allowed |

Each page has an "About this data" section with its sources, methods, and caveats.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. No accounts or API keys are needed: the data ships in `public/data/` and `src/data/`,
basemaps are CARTO's free Positron style with OpenStreetMap data, and address search uses OpenStreetMap's Nominatim.
Set `NOMINATIM_USER_AGENT` to your own app name and contact before deploying (see `.env.example`).

Built with Next.js, React, Tailwind CSS, MapLibre GL, Turf, and Recharts.

## Refreshing the data

Each pipeline writes static files that the pages load. In a proxied environment, run with `NODE_USE_ENV_PROXY=1` so
Node's `fetch` uses the proxy.

### Crashes

```bash
npm run data:crashes                       # all years IDOT has published, 2014 on
npm run data:crashes -- --from=2020 --to=2025
```

Downloads IDOT's yearly statewide crash layers, keeps crashes in Champaign, Urbana, and Savoy (using Census municipal
boundaries), and writes `public/data/crashes/`.

The published file also has heavy-vehicle and University District fields for 2020-2024 from the Champaign County
Regional Planning Commission's [crash dashboard](https://crashdashboard.ccrpc.org/), matched to IDOT records by
`scripts/ccrpc-supplement.mjs`. CCRPC's points aren't included in this repo, so a rebuild leaves those two fields
as "not available" unless you supply them (see the comments in that script).

### Parcels: Value Per Acre and Vacant Land

```bash
npm run data:parcels
npm run data:parcels -- --rate-book=<pdf url>       # pin a specific rate book
npm run data:parcels -- --skip-addresses
npm run data:parcels -- --cache=/tmp/parcel-cache   # reuse downloads while developing
```

Takes about 3 minutes. Builds `public/data/parcels/champaign-county-parcels.json` from:

- parcel boundaries and assessments: the Champaign County GIS Consortium's tax parcels, from the City of Champaign's
  public `TaxParcels_Assessed` map service
- tax rates by tax code, and each code's municipality: the Champaign County Clerk's rate book PDF
- site addresses: the county property tax inquiry's township search. Taxpayer names and mailing addresses are used
  only to flag vacant lots held with the property next door, and are discarded before anything is written.

Condo and townhome units, which the county maps as building footprints, are combined into approximate development
areas. Methods and planned improvements are in `docs/value-per-acre-next-steps.md`.

### Residential permits

```bash
npm run data:permits
```

New-construction permits provided by the City of Champaign are in `data/permits/champaign-residential-permits.csv`,
without coordinates. The script places each one at its address in the city's public Address Points layer, falling back
to the matching county parcel, then to a point between the neighboring addresses on the same side of the street. It
writes `src/data/residential-permits.json` and lists any permits it can't place.

### Dates shown on the pages

Each page shows what its data covers and when it was refreshed, from `src/data/data-updates.json`. The crash and
parcel scripts update their entries; update zoning's `asOf` by hand when you replace `public/data/zoning.geojson`.

## Adapting this for another place

- **Crashes:** change the county and cities in `scripts/fetch-idot-crashes.mjs` for anywhere in Illinois. Outside
  Illinois, replace the download with your state's crash data and keep the same output columns.
- **Parcels:** the parcel script is the most local part. You need parcels with assessed values, tax rates by tax
  district, and land use codes; map your county's use codes in `src/lib/parcels.ts` and `src/lib/vacant.ts`.
- **Zoning:** replace `public/data/zoning.geojson` and the district rules in `src/lib/zoning.ts` and
  `src/lib/buildTypes.ts`.
- **Basemap:** swap `CRASH_BASEMAP` and `PARCEL_BASEMAP` in `src/lib/*MapStyles.ts` for any MapLibre style.

## Data sources

| Data | Source |
|---|---|
| Crashes | [Illinois Department of Transportation](https://gis-idot.opendata.arcgis.com/) crash data |
| Heavy-vehicle and University District crash fields (2020-2024) | [CCRPC crash dashboard](https://crashdashboard.ccrpc.org/) |
| Municipal boundaries | U.S. Census Bureau TIGERweb |
| Parcels and assessments | Champaign County GIS Consortium, via the [City of Champaign's map service](https://gisportal.champaignil.gov/ms/rest/services/OpenGov/Open_Gov_Map_Service/MapServer/0) |
| Tax rates | [Champaign County Clerk](https://www.champaigncountyclerk.com/property-taxes/tax-extension-rates) rate books |
| Site addresses | [Champaign County property tax inquiry](https://champaignil.devnetwedge.com) |
| Zoning districts | City of Champaign [Zoning Classifications](https://gis-cityofchampaign.opendata.arcgis.com/datasets/a24e403a9fa245dbaaaf46f766860c40_15/explore) |
| Residential permits | Provided by the City of Champaign |
| Address points | City of Champaign [Address Points](https://gisportal.champaignil.gov/ms/rest/services/Open_Data/Open_Data/MapServer/7) |
| Basemap | © [CARTO](https://carto.com/attributions), © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) |

The data files are estimates for illustration, not official records: property values are three times equalized
assessed value, tax is before exemptions, and condo development areas are approximate. Check official sources before
relying on a number.

## Licenses

- **Code** is MIT-licensed; see `LICENSE`.
- **Adapted code** keeps its original MIT notices: the crash pages are adapted from the
  [Chicago Crash Dashboard](https://github.com/MisterClean/chicago-crashes-pipeline) by Michael McLean
  (`src/components/crashes/LICENSE-chicago-crash-dashboard.txt`), and the parcel maps from the
  [Strong Towns Chicago Value Per Acre map](https://github.com/StrongTownsChicago/chicago-value-per-acre)
  (`src/components/parcels/LICENSE-chicago-value-per-acre.txt`).
- **Data files** come from the public sources above, and each source's own terms still apply.
- The Abundant CU name and logo aren't covered by the license. If you publish a fork, use your own name.

## Contributing

This repository is published from Abundant CU's site, so changes made here directly may be overwritten by the next
export. Issues and suggestions are welcome; we'll carry accepted changes over.
