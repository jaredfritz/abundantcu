#!/usr/bin/env node
// Builds the parcel layer behind /data/zoning: every county parcel inside the City of Champaign's
// zoning map, tagged with the zoning district that covers it.
//
// Inputs (both already in the repo):
//   1. public/data/parcels/champaign-county-parcels.json, built by `npm run data:parcels`.
//   2. src/data/Zoning_-_Zoning_Classifications.geojson, the city's zoning districts.
//
// Each parcel is intersected with the zoning districts it overlaps. The district covering most of
// the parcel is its zone; a parcel split between districts also records the runner-up and the
// share of the parcel in each. Parcels less than half inside the zoning map (land outside the
// city's zoning jurisdiction) are left out.
//
// Output: public/data/zoning-parcels.json, a compact columnar file. Geometry is copied as-is from
// the parcel dataset (delta-encoded, decoded client-side by src/lib/zoningParcels.ts).
//
// Usage: npm run data:zoning-parcels (runs automatically at the end of `npm run data:parcels`)

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  area as turfArea,
  bbox as turfBbox,
  bboxClip,
  booleanPointInPolygon,
  centroid,
  featureCollection,
  intersect,
  multiPolygon,
  polygon,
} from "@turf/turf";

const PARCEL_FILE = path.join(process.cwd(), "public", "data", "parcels", "champaign-county-parcels.json");
const ZONING_FILE = path.join(process.cwd(), "src", "data", "Zoning_-_Zoning_Classifications.geojson");
const OUT_FILE = path.join(process.cwd(), "public", "data", "zoning-parcels.json");

// A parcel must be at least this share inside the zoning map to be included.
const MIN_ZONED_SHARE = 0.5;
// A runner-up district is recorded only when it covers at least this share of the parcel; smaller
// overlaps are slivers from lot lines and district lines that don't quite line up.
const MIN_SECONDARY_SHARE = 0.05;
// Parcels with more vertices than this are clipped to each district piece before intersecting.
const MAX_VERTICES_UNCLIPPED = 500;
// Districts are cut into grid cells of this size (degrees, about 550 m) so each parcel is tested
// against small pieces instead of whole districts, some of which have thousands of vertices.
const GRID_CELL = 0.005;

// The map labels manufactured home communities MHP; the ordinance code is MHC.
const normalizeCode = (code) => (code === "MHP" ? "MHC" : code);

function decodeRing(flat) {
  const ring = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < flat.length; i += 2) {
    x += flat[i];
    y += flat[i + 1];
    ring.push([x / 1e5, y / 1e5]);
  }
  // turf needs closed rings of at least four positions.
  if (ring.length && (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])) ring.push(ring[0]);
  return ring;
}

const bboxesOverlap = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

function cellKeys(box) {
  const keys = [];
  for (let gx = Math.floor(box[0] / GRID_CELL); gx <= Math.floor(box[2] / GRID_CELL); gx += 1) {
    for (let gy = Math.floor(box[1] / GRID_CELL); gy <= Math.floor(box[3] / GRID_CELL); gy += 1) {
      keys.push(`${gx},${gy}`);
    }
  }
  return keys;
}

function overlapArea(a, b) {
  try {
    const shared = intersect(featureCollection([a, b]));
    return shared ? turfArea(shared) : 0;
  } catch {
    return 0;
  }
}

export async function buildZoningParcels() {
  const parcels = JSON.parse(await readFile(PARCEL_FILE, "utf8"));
  const zoning = JSON.parse(await readFile(ZONING_FILE, "utf8"));

  const zones = zoning.features
    .filter((feature) => feature.geometry && feature.properties?.zoning_code)
    .map((feature) => ({ code: normalizeCode(feature.properties.zoning_code), feature, box: turfBbox(feature) }));
  // Cell key -> pieces of the districts inside that cell. Pieces of one district in different cells
  // don't overlap, so a parcel's overlap with a district is the sum over its pieces.
  const grid = new Map();
  for (const zone of zones) {
    for (const key of cellKeys(zone.box)) {
      const [gx, gy] = key.split(",").map(Number);
      const cell = [gx * GRID_CELL, gy * GRID_CELL, (gx + 1) * GRID_CELL, (gy + 1) * GRID_CELL];
      const piece = bboxClip(zone.feature, cell);
      if (turfArea(piece) <= 0) continue;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push({ code: zone.code, feature: piece, box: turfBbox(piece) });
    }
  }
  let zoningExtent = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { box } of zones) {
    zoningExtent = [
      Math.min(zoningExtent[0], box[0]),
      Math.min(zoningExtent[1], box[1]),
      Math.max(zoningExtent[2], box[2]),
      Math.max(zoningExtent[3], box[3]),
    ];
  }

  const zoneCodes = [];
  const zoneIndex = (code) => {
    if (!zoneCodes.includes(code)) zoneCodes.push(code);
    return zoneCodes.indexOf(code);
  };
  const useCodes = [];
  const useIndex = (code) => {
    if (!useCodes.includes(code)) useCodes.push(code);
    return useCodes.indexOf(code);
  };

  const { cols, dict } = parcels;
  const out = {
    pin: [],
    address: [],
    units: [],
    condoDev: [],
    useCode: [],
    exempt: [],
    area: [],
    zone: [],
    zoneShare: [],
    zone2: [],
    zone2Share: [],
    geom: [],
  };
  let split = 0;

  for (let i = 0; i < cols.pin.length; i += 1) {
    const polygons = cols.geom[i].map((rings) => rings.map(decodeRing)).filter((rings) => rings[0].length >= 4);
    if (polygons.length === 0) continue;
    let shape;
    try {
      shape = polygons.length === 1 ? polygon(polygons[0]) : multiPolygon(polygons);
    } catch {
      continue;
    }
    const box = turfBbox(shape);
    if (!bboxesOverlap(box, zoningExtent)) continue;

    const nearby = cellKeys(box)
      .flatMap((key) => grid.get(key) ?? [])
      .filter((piece) => bboxesOverlap(box, piece.box));
    if (nearby.length === 0) continue;
    const total = turfArea(shape);
    if (total <= 0) continue;

    // Most parcels sit wholly inside one district, and testing a few points is far cheaper than
    // intersecting. District lines usually follow lot lines, so the corners themselves sit on (or a
    // hair outside) a district edge; test points pulled 10% of the way toward the center instead.
    const [cx, cy] = centroid(shape).geometry.coordinates;
    const corners = polygons
      .flatMap((rings) => rings[0])
      .map(([x, y]) => [x + (cx - x) * 0.1, y + (cy - y) * 0.1]);
    corners.push([cx, cy]);
    const hits = new Map();
    for (const corner of corners) {
      const piece = nearby.find((candidate) => booleanPointInPolygon(corner, candidate.feature));
      if (piece) hits.set(piece.code, (hits.get(piece.code) ?? 0) + 1);
    }
    // No test point in any district: the parcel is outside the zoning map, or touches it only
    // along an edge.
    if (hits.size === 0) continue;
    const byCode = new Map();
    const [onlyCode, onlyCount] = hits.size === 1 ? [...hits.entries()][0] : [null, 0];
    if (onlyCount === corners.length) {
      byCode.set(onlyCode, total);
    } else {
      // Long parcels (rail corridors) have thousands of vertices, and intersecting all of them with
      // every piece they pass takes minutes, so clip those to each piece first. Clipping can leave
      // slivers on concave shapes, so ordinary parcels are intersected whole.
      const complex = corners.length > MAX_VERTICES_UNCLIPPED;
      for (const piece of nearby) {
        const shared = overlapArea(complex ? bboxClip(shape, piece.box) : shape, piece.feature);
        if (shared > 0) byCode.set(piece.code, (byCode.get(piece.code) ?? 0) + shared);
      }
    }
    if (byCode.size === 0) continue;
    const ranked = [...byCode.entries()].sort((a, b) => b[1] - a[1]);
    const zoned = ranked.reduce((sum, [, shared]) => sum + shared, 0);
    if (zoned / total < MIN_ZONED_SHARE) continue;

    const [primary, primaryArea] = ranked[0];
    const secondary = ranked[1] && ranked[1][1] / total >= MIN_SECONDARY_SHARE ? ranked[1] : null;
    if (secondary) split += 1;

    out.pin.push(cols.pin[i]);
    out.address.push(cols.address[i]);
    out.units.push(cols.units[i]);
    out.condoDev.push(cols.condoDev?.[i] ?? 0);
    out.useCode.push(useIndex(dict.useCode[cols.useCode[i]]));
    out.exempt.push(cols.exempt[i]);
    out.area.push(Math.round(cols.area[i]));
    out.zone.push(zoneIndex(primary));
    out.zoneShare.push(Math.min(100, Math.round((primaryArea / total) * 100)));
    out.zone2.push(secondary ? zoneIndex(secondary[0]) : -1);
    out.zone2Share.push(secondary ? Math.min(100, Math.round((secondary[1] / total) * 100)) : 0);
    out.geom.push(cols.geom[i]);
  }

  const dataset = {
    meta: {
      parcelSource: parcels.meta.parcelSource,
      parcelSourceUrl: parcels.meta.parcelSourceUrl,
      parcelsGeneratedAt: parcels.meta.generatedAt,
      zoningSource: "City of Champaign Zoning Classifications",
      generatedAt: new Date().toISOString(),
      parcels: out.pin.length,
      splitZoned: split,
    },
    dict: { zone: zoneCodes, useCode: useCodes },
    cols: out,
  };
  await writeFile(OUT_FILE, JSON.stringify(dataset));
  console.log(
    `Wrote ${out.pin.length.toLocaleString()} zoned parcels (${split.toLocaleString()} split between districts) to ${path.relative(process.cwd(), OUT_FILE)}.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildZoningParcels().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
