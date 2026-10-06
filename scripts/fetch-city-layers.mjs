#!/usr/bin/env node
// Builds the City of Champaign zoning and boundary layers behind /data/city-map.
//
// Source: the City of Champaign's public Open Data map service, the same layers its open data site
// (gis-cityofchampaign.opendata.arcgis.com) offers for download. No login needed.
//
// Output: one GeoJSON file per layer in public/data/city-layers/, with coordinates rounded to six
// decimals (about 10 cm) and only the fields the map shows. The page loads each file when its layer
// is turned on. Layer ids here must match CITY_LAYERS in src/lib/cityLayers.ts.
//
// Usage: npm run data:city-layers

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { markDatasetUpdated, writeIfChanged } from "./data-updates.mjs";

const SERVICE = "https://gisportal.champaignil.gov/ms/rest/services/Open_Data/Open_Data/MapServer";
const OUT_DIR = path.join(process.cwd(), "public", "data", "city-layers");
const PAGE_SIZE = 1000;
const USER_AGENT = "AbundantCU-data/1.0 (+https://abundantcu.com/data/city-map)";

/** Each layer: its number in the map service, and the source fields to keep, renamed to short keys. */
const LAYERS = [
  // The city labels manufactured home communities "MHP"; the ordinance (and src/lib/zoning.ts) calls them MHC.
  { id: "zoning", layer: 15, fields: { zoning_code: "code" }, fix: (props) => props.code === "MHP" && (props.code = "MHC") },
  { id: "planned-developments", layer: 19, fields: { Name: "name", Case_: "case", Address: "address", Status: "status", Council_Bill: "bill", Hyperlink1: "link" } },
  { id: "special-use-permits", layer: 20, fields: { Address: "address", SUP_Type: "type", Case_: "case", Status: "status", Effective_: "effective", Council_Bill: "bill", Hyperlink1: "link" } },
  { id: "historic", layer: 17, fields: { Landmark_Name: "name", Type: "type", Address: "address", Date_Desginated: "designated", Council_Bill: "bill", Hyperlink1: "link" } },
  { id: "annexation-agreements", layer: 16, fields: { Name: "name", Status: "status", Zoning: "zoning", Council_Bill: "bill", hyperlink1: "link" } },
  { id: "mitigation-plans", layer: 18, fields: { Name: "name", Case_: "case", Status: "status", Council_Bill: "bill", hyperlink1: "link" } },
  { id: "council-districts", layer: 1, fields: { District: "district", Council_me: "member" } },
  { id: "police-districts", layer: 26, fields: { District: "district", Area_Description: "area" } },
  { id: "police-beats", layer: 25, fields: { NAME: "beat" } },
  { id: "planning-areas", layer: 11, fields: { region_name: "name" } },
  { id: "neighborhood-orgs", layer: 12, fields: { Group_Name: "name", Group_Type: "type" } },
  { id: "tif-districts", layer: 5, fields: { name: "name" } },
  { id: "enterprise-zone", layer: 3, fields: { Name: "name", Expiration: "expires" } },
  { id: "special-service-areas", layer: 4, fields: { name: "name" } },
  { id: "fire-stations", layer: 24, fields: { Name: "name", FireHouseN: "station" } },
];

async function getJson(url) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
      return json;
    } catch (error) {
      if (attempt >= 4) throw new Error(`${url}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** (attempt - 1)));
    }
  }
}

const round = (value) => Math.round(value * 1e6) / 1e6;

function roundCoordinates(coords) {
  return typeof coords[0] === "number" ? [round(coords[0]), round(coords[1])] : coords.map(roundCoordinates);
}

function cleanValue(value, type) {
  if (value === null || value === undefined) return undefined;
  // The service stores a missing date as 1899-12-30 (day zero in Excel and SQL Server).
  if (type === "esriFieldTypeDate") return value > Date.UTC(1900, 0, 1) ? new Date(value).toISOString().slice(0, 10) : undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed !== "<Null>" ? trimmed : undefined;
  }
  return value;
}

async function fetchLayer({ id, layer, fields, fix }) {
  const info = await getJson(`${SERVICE}/${layer}?f=json`);
  const oidField = info.fields.find((field) => field.type === "esriFieldTypeOID").name;
  const types = Object.fromEntries(info.fields.map((field) => [field.name, field.type]));
  const missing = Object.keys(fields).filter((field) => !types[field]);
  if (missing.length) throw new Error(`${id}: fields not in layer ${layer}: ${missing.join(", ")}`);

  const features = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: Object.keys(fields).join(","),
      outSR: "4326",
      orderByFields: oidField,
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
      f: "geojson",
    });
    const page = await getJson(`${SERVICE}/${layer}/query?${params}`);
    for (const feature of page.features) {
      // A few records have no shape, or an empty one; there's nothing to map or click.
      if (!feature.geometry || feature.geometry.coordinates.flat(3).length === 0) continue;
      const properties = {};
      for (const [source, key] of Object.entries(fields)) {
        const value = cleanValue(feature.properties[source], types[source]);
        if (value !== undefined) properties[key] = value;
      }
      fix?.(properties);
      features.push({
        type: "Feature",
        properties,
        geometry: { type: feature.geometry.type, coordinates: roundCoordinates(feature.geometry.coordinates) },
      });
    }
    if (page.features.length < PAGE_SIZE) break;
  }
  // Number features so the map can highlight one; ids follow the service's object order.
  features.forEach((feature, index) => {
    feature.id = index;
  });
  return { type: "FeatureCollection", features };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let changed = 0;
  for (const layer of LAYERS) {
    const collection = await fetchLayer(layer);
    const file = path.join(OUT_DIR, `${layer.id}.geojson`);
    const wrote = await writeIfChanged(file, JSON.stringify(collection));
    if (wrote) changed += 1;
    console.log(`${layer.id}: ${collection.features.length} features${wrote ? "" : " (unchanged)"}`);
  }
  await markDatasetUpdated("cityLayers", {});
  console.log(`Done. ${changed} of ${LAYERS.length} layers changed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
