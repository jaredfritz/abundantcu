#!/usr/bin/env node
// Builds the countywide parcel dataset behind /data/value-per-acre.
//
// Sources (all public, no login):
//   1. Parcels + assessments: the City of Champaign's public "TaxParcels_Assessed" layer, which
//      republishes the Champaign County GIS Consortium (CCGISC) parcel polygons with the county's
//      assessed values for every parcel in Champaign County.
//   2. Tax rates: the Champaign County Clerk's "District Rates by Taxcode" rate book (PDF). Each
//      tax code's rate, and the municipality it belongs to, comes from this file.
//   3. Site addresses: the county's property tax inquiry site (DEVNET wEdge) township search,
//      exported to CSV. Owner names in that export are discarded.
//
// Output: public/data/parcels/champaign-county-parcels.json, a compact columnar file with
// delta-encoded geometry that the page decodes client-side.
//
// Usage: npm run data:parcels [-- --rate-book=<pdf url>] [-- --skip-addresses]

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { booleanPointInPolygon } from "@turf/turf";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const OUT_DIR = path.join(process.cwd(), "public", "data", "parcels");
const OUT_FILE = "champaign-county-parcels.json";

const PARCEL_LAYER =
  "https://gisportal.champaignil.gov/ms/rest/services/OpenGov/Open_Gov_Map_Service/MapServer/0";
const CLERK_RATES_PAGE = "https://www.champaigncountyclerk.com/property-taxes/tax-extension-rates";
const DEVNET = "https://champaignil.devnetwedge.com";
const TIGER_PLACES =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/4/query";
const CHAMPAIGN_COUNTY_BBOX = "-88.47,39.87,-87.92,40.41";
const PAGE_SIZE = 2000;
const USER_AGENT = "AbundantCU-data/1.0 (+https://abundantcu.com/data/value-per-acre)";
// The clerk's CDN rejects requests that don't look like a browser. We only fetch two public files.
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
};

const PARCEL_FIELDS = [
  "PIN",
  "TaxParcelType",
  "TaxCode",
  "UseCode",
  "Tax_Status",
  "EAV",
  "AssessedLand",
  "AssessedFarmland",
  "AssessedBuilding",
  "AssessedFarmBuilding",
  "Shape.STArea()",
];

// TaxParcelType 3 polygons are wind/solar lease areas drawn on top of the farm parcels they sit
// on. Mapping both would double count that land, so the lease polygons are left out.
const LEASE_PARCEL_TYPE = 3;
// TaxParcelType 1 polygons are condominium units; units in one building share the same footprint.
const CONDO_PARCEL_TYPE = 1;

function parseArgs() {
  return Object.fromEntries(
    process.argv
      .slice(2)
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => {
        const [key, ...rest] = arg.slice(2).split("=");
        return [key, rest.length ? rest.join("=") : "true"];
      }),
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url, init = {}, parse = (res) => res.json()) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": USER_AGENT, ...init.headers },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const body = await parse(res);
      if (body?.error) throw new Error(JSON.stringify(body.error));
      return body;
    } catch (error) {
      if (attempt >= 4) throw new Error(`Request failed for ${url}: ${error.message}`);
      await sleep(1000 * 2 ** attempt);
    }
  }
}

// ---------------------------------------------------------------------------
// 1. Parcels
// ---------------------------------------------------------------------------

async function fetchParcels() {
  const features = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: PARCEL_FIELDS.join(","),
      returnGeometry: "true",
      outSR: "4326",
      geometryPrecision: "6",
      orderByFields: "OBJECTID",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
      f: "geojson",
    });
    const json = await request(`${PARCEL_LAYER}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const page = json.features ?? [];
    features.push(...page);
    process.stdout.write(`\r  parcels: ${features.length.toLocaleString()}`);
    if (page.length < PAGE_SIZE) break;
    await sleep(250);
  }
  process.stdout.write("\n");
  return features;
}

// ---------------------------------------------------------------------------
// 2. Tax rates by tax code
// ---------------------------------------------------------------------------

async function findRateBookUrl() {
  const html = await request(CLERK_RATES_PAGE, { headers: BROWSER_HEADERS }, (res) => res.text());
  // The page lists the newest year first; rate books are named e.g. rate-book-2025-2026.pdf
  // or district-rates-taxcode-2024.pdf.
  const links = [...html.matchAll(/href="([^"]+\.pdf)"/gi)].map((match) => match[1]);
  const rateBook = links.find((href) => /rate-?book|district-?rates/i.test(href));
  if (!rateBook) throw new Error(`No rate book PDF found on ${CLERK_RATES_PAGE}`);
  return new URL(rateBook, CLERK_RATES_PAGE).toString();
}

async function pdfLines(url) {
  const data = new Uint8Array(await request(url, { headers: BROWSER_HEADERS }, (res) => res.arrayBuffer()));
  const doc = await getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;
  const lines = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const { items } = await page.getTextContent();
    const rows = new Map();
    for (const item of items) {
      if (!("str" in item)) continue;
      const y = Math.round(item.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push(item);
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const text = rows
        .get(y)
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((item) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) lines.push(text);
    }
  }
  return lines;
}

// "Champaign City" -> "Champaign", "St. Joseph Village" -> "St. Joseph"
const municipalityName = (district) => district.replace(/\s+(City|Village|Town)$/i, "").trim();

async function fetchTaxRates(url) {
  const lines = await pdfLines(url);
  const taxYear = Number(lines.join(" ").match(/Tax Year:\s*(\d{4})/)?.[1]) || null;
  const codes = new Map();
  let current = null;
  for (const line of lines) {
    const header = line.match(/^Tax Code (\d{4}[A-Z]?) -\s*(.*?)(?:\s*Tax Code Rate\s+([\d.]+))?$/);
    if (header) {
      current = { code: header[1], label: header[2].trim(), rate: header[3] ? Number(header[3]) : null, city: null };
      codes.set(current.code, current);
      continue;
    }
    if (!current) continue;
    const rateOnly = line.match(/^Tax Code Rate\s+([\d.]+)$/);
    if (rateOnly) current.rate = Number(rateOnly[1]);
    const total = line.match(/^Totals for (\d{4}[A-Z]?)\s+([\d.]+)$/);
    if (total && codes.has(total[1])) codes.get(total[1]).rate ??= Number(total[2]);
    // Districts numbered 05xx are the county's cities and villages.
    const municipality = line.match(/^05\d\d - (.+?)\s+[\d.]+$/);
    if (municipality) current.city = municipalityName(municipality[1]);
  }
  for (const entry of codes.values()) {
    // Labels look like "4102 + CHAMPAIGN TIF VII GARDEN HILLS"; keep only the TIF name.
    const tif = entry.label.match(/\+\s*(.*TIF.*)$/i)?.[1];
    entry.tif = tif ? tif.replace(/\s+/g, " ").trim() : null;
  }
  return { taxYear, codes };
}

// ---------------------------------------------------------------------------
// 3. Site addresses (township search export from the county tax inquiry site)
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

async function devnetSession() {
  const res = await fetch(`${DEVNET}/`, { headers: { "User-Agent": USER_AGENT } });
  const cookies = res.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
  return cookies.join("; ");
}

async function fetchAddresses() {
  const townships = await request(`${DEVNET}/Search/GetTownships`);
  const addresses = new Map();
  for (const township of townships) {
    // Each search lives in the server-side session, so give every township a fresh one.
    const cookie = await devnetSession();
    await fetch(`${DEVNET}/Search/ExecuteParcelSearch`, {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ search_tab: "advanced-parcel-search", townships: township.Value }),
      redirect: "manual",
    });
    const csv = await request(
      `${DEVNET}/Search/ExportClientsListToCSV`,
      { headers: { Cookie: cookie } },
      (res) => res.text(),
    );
    const [header, ...rows] = parseCsv(csv);
    const pinColumn = header?.indexOf("Property Account Number") ?? -1;
    const addressColumn = header?.indexOf("Address") ?? -1;
    if (pinColumn < 0 || addressColumn < 0) throw new Error(`Unexpected export columns: ${header}`);
    let count = 0;
    for (const row of rows) {
      const pin = row[pinColumn]?.replace(/\D/g, "");
      const address = row[addressColumn]?.replace(/\s+/g, " ").trim();
      if (pin && address) {
        addresses.set(pin, address);
        count += 1;
      }
    }
    console.log(`  ${township.Text}: ${count.toLocaleString()} addresses`);
    await sleep(1000);
  }
  return addresses;
}

// ---------------------------------------------------------------------------
// 4. Census municipal boundaries, used only for parcels whose tax code is newer than the rate book
// ---------------------------------------------------------------------------

async function fetchPlaces() {
  const params = new URLSearchParams({
    where: "STATE='17'",
    geometry: CHAMPAIGN_COUNTY_BBOX,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "BASENAME",
    outSR: "4326",
    f: "geojson",
  });
  const json = await request(`${TIGER_PLACES}?${params}`);
  return json.features ?? [];
}

function placeAt(places, polygons) {
  const ring = polygons[0]?.[0] ?? [];
  if (ring.length === 0) return null;
  const point = [
    ring.reduce((sum, [lon]) => sum + lon, 0) / ring.length,
    ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length,
  ];
  return places.find((place) => booleanPointInPolygon(point, place))?.properties.BASENAME ?? null;
}

// ---------------------------------------------------------------------------
// Cleaning and encoding
// ---------------------------------------------------------------------------

const int = (value) => (Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0);
const numberOrNull = (value) => (value === null || value === undefined || value === "" ? null : int(value));

function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

// Quantize to 1e-5 degrees (about 1 m) and delta-encode each ring: [x0, y0, dx1, dy1, ...].
function encodePolygons(polygons) {
  return polygons.map((rings) =>
    rings.map((ring) => {
      const flat = [];
      let px = 0;
      let py = 0;
      for (const [lon, lat] of ring) {
        const x = Math.round(lon * 1e5);
        const y = Math.round(lat * 1e5);
        if (flat.length && x === px && y === py) continue;
        flat.push(flat.length ? x - px : x, flat.length ? y - py : y);
        px = x;
        py = y;
      }
      return flat;
    }),
  );
}

const geometryKey = (polygons) => JSON.stringify(encodePolygons(polygons));

class Dictionary {
  constructor() {
    this.values = [];
    this.index = new Map();
  }

  id(raw) {
    const value = raw ?? "";
    if (!this.index.has(value)) {
      this.index.set(value, this.values.length);
      this.values.push(value);
    }
    return this.index.get(value);
  }
}

function buildParcels(features, { codes }, addresses, places) {
  // Merge polygons that share a PIN (parcels split by roads or rail are drawn as several pieces).
  const byPin = new Map();
  let leaseDropped = 0;
  for (const feature of features) {
    const p = feature.properties ?? {};
    if (p.TaxParcelType === LEASE_PARCEL_TYPE) {
      leaseDropped += 1;
      continue;
    }
    const pin = String(p.PIN ?? "").trim();
    const polygons = polygonsOf(feature.geometry);
    if (!pin || polygons.length === 0) continue;
    const existing = byPin.get(pin);
    if (existing) {
      existing.polygons.push(...polygons);
      existing.area += Number(p["Shape.STArea()"]) || 0;
      continue;
    }
    byPin.set(pin, {
      pins: [pin],
      condo: p.TaxParcelType === CONDO_PARCEL_TYPE,
      taxCode: p.TaxCode ?? "",
      useCode: p.UseCode ?? "",
      exempt: p.Tax_Status === "E",
      eav: numberOrNull(p.EAV),
      land: int(p.AssessedLand) + int(p.AssessedFarmland),
      building: int(p.AssessedBuilding) + int(p.AssessedFarmBuilding),
      area: Number(p["Shape.STArea()"]) || 0,
      polygons,
    });
  }

  // Condo units in one building share an identical footprint. Combine each stack into a single
  // parcel so the building's full value sits on its land once.
  const parcels = [];
  const stacks = new Map();
  for (const parcel of byPin.values()) {
    if (!parcel.condo) {
      parcels.push(parcel);
      continue;
    }
    const key = geometryKey(parcel.polygons);
    const stack = stacks.get(key);
    if (!stack) {
      stacks.set(key, parcel);
      parcels.push(parcel);
      continue;
    }
    stack.pins.push(...parcel.pins);
    stack.eav = stack.eav === null && parcel.eav === null ? null : (stack.eav ?? 0) + (parcel.eav ?? 0);
    stack.land += parcel.land;
    stack.building += parcel.building;
    stack.exempt &&= parcel.exempt;
  }

  const dicts = { useCode: new Dictionary(), city: new Dictionary(), taxCode: new Dictionary() };
  const cols = { pin: [], address: [], units: [], useCode: [], city: [], taxCode: [], exempt: [], eav: [], land: [], building: [], area: [], geom: [] };
  const missingTaxCodes = new Set();

  for (const parcel of parcels) {
    parcel.pins.sort();
    const pin = parcel.pins[0];
    const taxCode = codes.get(parcel.taxCode);
    if (parcel.taxCode && !taxCode) missingTaxCodes.add(parcel.taxCode);
    cols.pin.push(pin);
    cols.address.push(parcel.pins.map((p) => addresses.get(p)).find(Boolean) ?? "");
    cols.units.push(parcel.pins.length);
    cols.useCode.push(dicts.useCode.id(parcel.useCode));
    // Tax codes carry the municipality. A code created after the rate book was published falls back
    // to the Census place boundary the parcel sits in.
    const city = taxCode ? taxCode.city : placeAt(places, parcel.polygons);
    cols.city.push(dicts.city.id(city ?? "Unincorporated"));
    cols.taxCode.push(dicts.taxCode.id(parcel.taxCode));
    cols.exempt.push(parcel.exempt ? 1 : 0);
    cols.eav.push(parcel.eav);
    cols.land.push(parcel.land);
    cols.building.push(parcel.building);
    cols.area.push(Math.round(parcel.area));
    cols.geom.push(encodePolygons(parcel.polygons));
  }

  if (missingTaxCodes.size) {
    console.warn(`  ${missingTaxCodes.size} tax codes missing from the rate book: ${[...missingTaxCodes].join(", ")}`);
  }

  return {
    dicts,
    cols,
    stats: {
      sourceFeatures: features.length,
      leaseDropped,
      mergedPins: byPin.size,
      condoStacks: [...stacks.values()].filter((stack) => stack.pins.length > 1).length,
      parcels: parcels.length,
    },
  };
}

async function main() {
  const args = parseArgs();
  await mkdir(OUT_DIR, { recursive: true });

  console.log("Fetching assessed parcels...");
  const features = await fetchParcels();

  const rateBookUrl = args["rate-book"] ?? (await findRateBookUrl());
  console.log(`Reading tax rates from ${rateBookUrl}`);
  const rates = await fetchTaxRates(rateBookUrl);
  console.log(`  ${rates.codes.size} tax codes, tax year ${rates.taxYear}`);

  let addresses = new Map();
  if (args["skip-addresses"] !== "true") {
    console.log("Fetching site addresses...");
    try {
      addresses = await fetchAddresses();
    } catch (error) {
      console.warn(`  Skipped addresses: ${error.message}`);
    }
  }

  let places = [];
  try {
    places = await fetchPlaces();
  } catch (error) {
    console.warn(`  Skipped municipal boundaries: ${error.message}`);
  }

  const { dicts, cols, stats } = buildParcels(features, rates, addresses, places);
  const taxCodes = dicts.taxCode.values.map((code) => rates.codes.get(code));
  const dataset = {
    meta: {
      parcelSource: "Champaign County GIS Consortium tax parcels with assessments, via City of Champaign GIS",
      parcelSourceUrl: PARCEL_LAYER,
      rateSource: "Champaign County Clerk, District Rates by Taxcode",
      rateSourceUrl: rateBookUrl,
      addressSource: "Champaign County Property Tax Inquiry",
      addressSourceUrl: DEVNET,
      taxYear: rates.taxYear,
      generatedAt: new Date().toISOString(),
      ...stats,
    },
    dict: {
      useCode: dicts.useCode.values,
      city: dicts.city.values,
      taxCode: dicts.taxCode.values,
      taxRate: taxCodes.map((code) => code?.rate ?? null),
      tif: taxCodes.map((code) => code?.tif ?? null),
    },
    cols,
  };

  await writeFile(path.join(OUT_DIR, OUT_FILE), JSON.stringify(dataset));
  console.log(
    `Wrote ${stats.parcels.toLocaleString()} parcels (${stats.condoStacks.toLocaleString()} condo buildings, ` +
      `${stats.leaseDropped} lease polygons dropped, ${addresses.size.toLocaleString()} addresses).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
