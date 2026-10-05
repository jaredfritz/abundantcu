// Places the City of Champaign's residential building permits on the map.
//
//   node scripts/locate-permits.mjs
//
// Input: data/permits/champaign-residential-permits.csv, the new-construction permit records provided by
// the City of Champaign (permit number, year, address, type, units). Each address is matched to:
//   1. the City of Champaign's official Address Points layer (including retired addresses, since
//      older permits can use addresses that were later replaced), then
//   2. the county site addresses in the parcel data (npm run data:parcels), placing the permit inside
//      the matching parcel.
// Permits that match neither are listed and left off the map.
//
// Output: src/data/residential-permits.json (GeoJSON points).

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as turf from "@turf/turf";

const INPUT = path.join(process.cwd(), "data", "permits", "champaign-residential-permits.csv");
const OUTPUT = path.join(process.cwd(), "src", "data", "residential-permits.json");
const PARCELS = path.join(process.cwd(), "public", "data", "parcels", "champaign-county-parcels.json");
const ADDRESS_POINTS = "https://gisportal.champaignil.gov/ms/rest/services/Open_Data/Open_Data/MapServer/7";

// Same abbreviations as the parcel search (src/lib/parcels.ts), plus spelled-out numbered streets.
const ABBREVIATIONS = {
  STREET: "ST",
  AVENUE: "AVE",
  AV: "AVE",
  DRIVE: "DR",
  ROAD: "RD",
  BOULEVARD: "BLVD",
  COURT: "CT",
  LANE: "LN",
  PLACE: "PL",
  CIRCLE: "CIR",
  PARKWAY: "PKWY",
  TERRACE: "TER",
  HIGHWAY: "HWY",
  TRAIL: "TRL",
  CROSSING: "XING",
  SQUARE: "SQ",
  POINT: "PT",
  NORTH: "N",
  SOUTH: "S",
  EAST: "E",
  WEST: "W",
  FIRST: "1ST",
  SECOND: "2ND",
  THIRD: "3RD",
  FOURTH: "4TH",
  FIFTH: "5TH",
  SIXTH: "6TH",
  SEVENTH: "7TH",
  EIGHTH: "8TH",
  NINTH: "9TH",
  TENTH: "10TH",
};
// Street types, dropped for the looser match: permits often leave them off ("308 E GREEN").
const STREET_TYPES = new Set([
  "ST", "AVE", "DR", "RD", "BLVD", "CT", "LN", "PL", "CIR", "PKWY", "TER", "HWY", "TRL", "XING", "SQ", "WAY",
  "RUN", "LOOP", "PATH", "BND", "CV", "PASS", "PT", "POINTE",
]);

const tokens = (text) =>
  text
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ABBREVIATIONS[token] ?? token);
const exactKey = (words) => words.join(" ");
const looseKey = (words) => words.filter((word, i) => i === 0 || !STREET_TYPES.has(word)).join(" ");
// Some addresses leave off the direction ("37 CHALMERS ST" for 37 E Chalmers St), so the loosest match
// drops it too. It's only used when the address is unambiguous without it.
const DIRECTIONS = new Set(["N", "S", "E", "W"]);
const undirectedKey = (words) => looseKey(words.filter((word, i) => i !== 1 || !DIRECTIONS.has(word)));
const AMBIGUOUS = "ambiguous";

function parseCsv(text) {
  const [header, ...lines] = text.trim().split("\n");
  const columns = header.split(",");
  return lines.map((line) => {
    const values = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((cell) => cell.replace(/,$/, ""));
    return Object.fromEntries(
      columns.map((column, i) => [column, (values[i] ?? "").replace(/^"(.*)"$/, "$1").replace(/""/g, '"')]),
    );
  });
}

/** Candidate street addresses for a permit: ranges ("2742-2744 J T COFFMAN DR") try each number. */
function candidates(address) {
  const cleaned = address
    .toUpperCase()
    .replace(/\b(\d+)\s+1\/2\b/, "$1")
    .replace(/\s+(BLDG|BUILDING|UNIT|APT|#)\s*\S*$/, "")
    .trim();
  const range = cleaned.match(/^(\d+)\s*-\s*(\d+)\s+(.*)$/);
  if (!range) return [cleaned];
  const [, start, end, street] = range;
  const numbers = [Number(start), Number(end)];
  for (let n = Number(start) + 2; n < Number(end); n += 2) numbers.push(n);
  return numbers.map((n) => `${n} ${street}`);
}

class AddressIndex {
  maps = [
    [exactKey, new Map()],
    [looseKey, new Map()],
    [undirectedKey, new Map()],
  ];

  add(address, point) {
    const words = tokens(address);
    for (const [key, map] of this.maps) {
      const existing = map.get(key(words));
      if (!existing) map.set(key(words), point);
      // Two different places share this key (e.g. 410 E and 410 W Maple St): don't guess between them.
      else if (existing !== AMBIGUOUS && turf.distance(existing, point, { units: "meters" }) > 100) {
        map.set(key(words), AMBIGUOUS);
      }
    }
  }

  find(address) {
    for (const [key, map] of this.maps) {
      for (const candidate of candidates(address)) {
        const point = map.get(key(tokens(candidate)));
        if (point && point !== AMBIGUOUS) return point;
      }
    }
    return null;
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

async function loadAddressPoints() {
  const index = new AddressIndex();
  const { count } = await fetchJson(`${ADDRESS_POINTS}/query?where=1%3D1&returnCountOnly=true&f=json`);
  const rows = [];
  for (let offset = 0; offset < count; offset += 2000) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "StreetAddress,Status,MainPoint,CompSubAddress",
      outSR: "4326",
      orderByFields: "OBJECTID_1",
      resultOffset: String(offset),
      resultRecordCount: "2000",
      f: "json",
    });
    const page = await fetchJson(`${ADDRESS_POINTS}/query?${params}`);
    rows.push(...page.features);
  }
  // Active main points first, so a retired or unit point is only used when nothing better exists.
  const rank = ({ attributes: a }) =>
    (a.Status === "Active" ? 0 : 2) + (a.MainPoint === "Y" && !a.CompSubAddress ? 0 : 1);
  rows.sort((a, b) => rank(a) - rank(b));
  for (const { attributes, geometry } of rows) {
    if (attributes.StreetAddress && geometry) index.add(attributes.StreetAddress, [geometry.x, geometry.y]);
  }
  console.log(`Loaded ${rows.length.toLocaleString()} City of Champaign address points.`);
  return index;
}

function decodeRing(flat) {
  const ring = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < flat.length; i += 2) {
    x += flat[i];
    y += flat[i + 1];
    ring.push([x / 1e5, y / 1e5]);
  }
  return ring;
}

/** A point inside the parcel: its center of mass, or a point on its surface for odd shapes. */
function parcelPoint(geom) {
  const parcel = turf.multiPolygon(geom.map((rings) => rings.map(decodeRing)));
  const center = turf.centerOfMass(parcel);
  const point = turf.booleanPointInPolygon(center, parcel) ? center : turf.pointOnFeature(parcel);
  return point.geometry.coordinates.map((value) => Math.round(value * 1e6) / 1e6);
}

async function loadParcelAddresses() {
  const index = new AddressIndex();
  const { cols } = JSON.parse(await readFile(PARCELS, "utf8"));
  for (let i = 0; i < cols.pin.length; i += 1) {
    const addresses = [cols.address[i], ...(cols.otherAddresses?.[i] ? cols.otherAddresses[i].split("|") : [])];
    let point = null;
    for (const address of addresses) {
      // County site addresses end with the city ("518 BRADLEY AVE CHAMPAIGN UNIT 2"); permits are all Champaign.
      const match = address?.toUpperCase().match(/^(.*?)\s+CHAMPAIGN(\s+UNIT\b.*)?$/);
      if (!match) continue;
      point ??= parcelPoint(cols.geom[i]);
      index.add(match[1], point);
    }
  }
  return index;
}

async function main() {
  const permits = parseCsv(await readFile(INPUT, "utf8"));
  const [addressPoints, parcels] = await Promise.all([loadAddressPoints(), loadParcelAddresses()]);

  const features = [];
  const unmatched = [];
  const counts = { address_point: 0, parcel: 0 };
  for (const permit of permits) {
    let located = "address_point";
    let point = addressPoints.find(permit.address);
    if (!point) {
      located = "parcel";
      point = parcels.find(permit.address);
    }
    if (!point) {
      unmatched.push(permit);
      continue;
    }
    counts[located] += 1;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: point.map((value) => Math.round(value * 1e6) / 1e6) },
      properties: {
        permit_no: permit.permit_no,
        year: Number(permit.year),
        address: permit.address,
        permit_type: permit.permit_type,
        building_type: permit.building_type,
        units: Number(permit.units),
        located,
      },
    });
  }

  // "meta" isn't part of GeoJSON, but map libraries ignore it; the site uses it for the "About this data" notes.
  const meta = { source: "City of Champaign", permits: permits.length, placed: features.length };
  await writeFile(OUTPUT, `${JSON.stringify({ type: "FeatureCollection", meta, features })}\n`);
  console.log(
    `Placed ${features.length} of ${permits.length} permits: ${counts.address_point} at city address points, ` +
      `${counts.parcel} in matching parcels.`,
  );
  if (unmatched.length > 0) {
    console.log(`Not placed (${unmatched.length}):`);
    for (const permit of unmatched) console.log(`  ${permit.permit_no}  ${permit.address}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
