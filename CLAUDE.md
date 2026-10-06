# Abundant CU

The full site for abundantcu.com. See README.md for setup, data scripts, and services.

## Where to build

- Develop every change in this repository (`jaredfritz/abundantcu`), including changes to the `/data` tools.
- `jaredfritz/cu-data-tools` is the open-source copy of the `/data` tools. Don't edit it, clone it, run
  `npm run export:public`, or push to it unless the owner asks. Publishing there is a separate decision made after a
  change ships here; see "Public data tools" in README.md.
- Keeping `public-tools/` and `scripts/export-public-tools.mjs` in step with a change, so a later export works, is
  fine and expected.
- Parcel-derived files (`public/data/parcels/`, `public/data/zoning-parcels.json`) must never be exported: the
  Champaign County GIS Consortium's terms don't allow redistributing them.
