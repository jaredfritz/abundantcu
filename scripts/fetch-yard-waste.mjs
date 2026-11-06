// Downloads the City of Champaign's yard waste collection zones and their pickup dates.
//
//   node scripts/fetch-yard-waste.mjs
//
// Source: the map services behind the city's Yard Waste Collection map
// (https://experience.arcgis.com/experience/8133ffc42b9741aea6e9a1f3d49b7a4f), published by Public Works. The city keeps
// one service for the fall collection and one for spring. Each zone's pickup dates are a line of text such as
// "Mondays: Oct 26, Nov 9, Nov 30", with no year. The script finds the year from the weekday ("Mondays" means every
// date must be a Monday), then keeps the season that is under way or coming up next, so the page moves to the spring
// schedule as soon as the city publishes it. If the city changes how it writes the dates, the script stops with the
// text it couldn't read rather than guessing.
//
// Output: src/data/yard-waste.json (zones, dates, and simplified zone boundaries). Its entry in
// src/data/data-updates.json is updated only when the data changes.

import { readFile } from "node:fs/promises";
import path from "node:path";
import * as turf from "@turf/turf";
import { markDatasetUpdated, writeIfChanged } from "./data-updates.mjs";

const OUTPUT = path.join(process.cwd(), "src", "data", "yard-waste.json");
const SERVICE_ROOT = "https://gisportal.champaignil.gov/ms/rest/services/PWD";
const SOURCES = [
  // Fall: orange and blue zones are separate layers.
  { service: "Yardwaste_fall", layers: [2, 4] },
  // Spring: one layer with every zone.
  { service: "Yardwaste", layers: [1] },
];
const CITY_PAGE_URL = "https://champaignil.gov/public-works/yard-waste/";
const CITY_MAP_URL = "https://experience.arcgis.com/experience/8133ffc42b9741aea6e9a1f3d49b7a4f";
const CITY_EMAIL_LIST_URL = "https://champaignil.gov/email-subscription-lists/";

// About half a meter. Zone lines follow streets and rear lot lines, so keep them close to the city's.
const SIMPLIFY_DEGREES = 0.000005;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ZONE_COLORS = { "ORANGE ZONE": "orange", "BLUE ZONE": "blue" };

async function fetchJson(url) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "AbundantCU-data/1.0 (+https://abundantcu.com/data/yard-waste)" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (body.error) throw new Error(body.error.message ?? JSON.stringify(body.error));
      return body;
    } catch (error) {
      if (attempt >= 3) throw new Error(`${url}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

async function fetchLayer(service, layer) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "ZoneID,Zones,Name,Number,Collection,Notes",
    outSR: "4326",
    geometryPrecision: "6",
    maxAllowableOffset: String(SIMPLIFY_DEGREES),
    f: "geojson",
  });
  const url = `${SERVICE_ROOT}/${service}/MapServer/${layer}/query?${params}`;
  const collection = await fetchJson(url);
  return collection.features;
}

const iso = (date) => date.toISOString().slice(0, 10);
const utcDate = (year, month, day) => new Date(Date.UTC(year, month, day));

/**
 * Reads "Mondays: Oct 26, Nov 9, Nov 30" into { weekday: 1, dates: [{ month: 9, day: 26 }, ...] }. Also reads a range
 * ("Apr 13-17", "Apr 13 - Apr 17") and "Week of Apr 13" (a Monday-Friday week), in case the spring schedule is written
 * by week.
 */
function parseCollection(text) {
  let rest = text.replace(/\s+/g, " ").trim();
  let weekday = null;
  const prefix = rest.match(/^([A-Za-z]+?)s?\s*:\s*/);
  if (prefix) {
    const index = WEEKDAYS.indexOf(prefix[1].toLowerCase());
    if (index >= 0) weekday = index;
    rest = rest.slice(prefix[0].length);
  }
  const byWeek = /\bweeks? of\b/i.test(rest);
  rest = rest.replace(/\bweeks? of\b/gi, "");
  const monthDay = String.raw`([A-Za-z]{3,9})\.?\s*(\d{1,2})`;
  const single = new RegExp(String.raw`^${monthDay}(?:\s*[-–]\s*(?:([A-Za-z]{3,9})\.?\s*)?(\d{1,2}))?$`);
  const pickups = [];
  for (const raw of rest.split(/,|&|\band\b/).map((part) => part.trim()).filter(Boolean)) {
    const match = raw.match(single);
    const month = match ? MONTHS.indexOf(match[1].slice(0, 3).toLowerCase()) : -1;
    const endMonth = match?.[3] ? MONTHS.indexOf(match[3].slice(0, 3).toLowerCase()) : month;
    if (!match || month < 0 || endMonth < 0) {
      throw new Error(`Can't read the date "${raw}" in "${text}". Update parseCollection in scripts/fetch-yard-waste.mjs.`);
    }
    const start = { month, day: Number(match[2]) };
    const end = match[4] ? { month: endMonth, day: Number(match[4]) } : byWeek ? null : start;
    pickups.push({ start, end });
  }
  if (pickups.length === 0) throw new Error(`No dates in "${text}".`);
  return { weekday, pickups };
}

/** Real dates for a parsed schedule in `year`. A season that runs into January would cross the new year. */
function datesInYear(parsed, year) {
  let previous = null;
  let offset = 0;
  return parsed.pickups.map(({ start, end }) => {
    if (previous !== null && start.month < previous) offset = 1;
    previous = start.month;
    const startDate = utcDate(year + offset, start.month, start.day);
    let endDate;
    if (end) {
      endDate = utcDate(year + offset + (end.month < start.month ? 1 : 0), end.month, end.day);
    } else {
      // "Week of": through Friday of that week.
      endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + ((5 - startDate.getUTCDay() + 7) % 7));
    }
    return { startDate, endDate };
  });
}

/**
 * The year that fits every zone's dates: the weekday each zone names must match all its dates. Without weekdays,
 * the year that puts the season closest to today.
 */
function chooseYear(zones, today) {
  const candidates = [today.getUTCFullYear() - 1, today.getUTCFullYear(), today.getUTCFullYear() + 1];
  const fits = candidates.filter((year) =>
    zones.every(
      (zone) =>
        zone.parsed.weekday === null ||
        datesInYear(zone.parsed, year).every(({ startDate }) => startDate.getUTCDay() === zone.parsed.weekday),
    ),
  );
  const distance = (year) => {
    const first = Math.min(...zones.flatMap((zone) => datesInYear(zone.parsed, year).map(({ startDate }) => +startDate)));
    return Math.abs(first - +today);
  };
  const pool = fits.length > 0 ? fits : candidates;
  if (fits.length === 0 && zones.some((zone) => zone.parsed.weekday !== null)) {
    throw new Error("The pickup dates don't fall on the weekdays the zones name in any nearby year. Check the city's data.");
  }
  return pool.sort((a, b) => distance(a) - distance(b))[0];
}

/** A point inside the zone's largest piece, for its label. */
function labelPoint(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const largest = polygons
    .map((coordinates) => turf.polygon(coordinates))
    .sort((a, b) => turf.area(b) - turf.area(a))[0];
  const center = turf.centerOfMass(largest);
  const point = turf.booleanPointInPolygon(center, largest) ? center : turf.pointOnFeature(largest);
  return point.geometry.coordinates.map((value) => Number(value.toFixed(5)));
}

async function loadSeason({ service, layers }, today) {
  const features = (await Promise.all(layers.map((layer) => fetchLayer(service, layer)))).flat();
  if (features.length === 0) throw new Error(`${service} has no zones.`);
  const zones = features.map((feature) => {
    const props = feature.properties;
    return { props, geometry: feature.geometry, parsed: parseCollection(props.Collection ?? "") };
  });
  const year = chooseYear(zones, today);
  const built = zones
    .sort((a, b) => (a.props.Number ?? 0) - (b.props.Number ?? 0))
    .map(({ props, geometry, parsed }) => {
      const pickups = datesInYear(parsed, year).map(({ startDate, endDate }) => ({
        start: iso(startDate),
        end: iso(endDate),
      }));
      const id = String(props.ZoneID).trim();
      return {
        id,
        name: String(props.Name ?? id).trim(),
        color: ZONE_COLORS[String(props.Zones).trim().toUpperCase()] ?? "other",
        weekday: parsed.weekday === null ? null : WEEKDAYS[parsed.weekday][0].toUpperCase() + WEEKDAYS[parsed.weekday].slice(1),
        schedule: String(props.Collection).replace(/\s+/g, " ").trim(),
        pickups,
        label: labelPoint(geometry),
        geometry,
      };
    });
  const ids = new Set(built.map((zone) => zone.id));
  if (ids.size !== built.length) throw new Error(`${service} has more than one zone with the same ID.`);
  const starts = built.flatMap((zone) => zone.pickups.map((pickup) => pickup.start)).sort();
  const ends = built.flatMap((zone) => zone.pickups.map((pickup) => pickup.end)).sort();
  const firstMonth = Number(starts[0].slice(5, 7));
  const season = firstMonth >= 7 ? "fall" : "spring";
  const notes = [...new Set(features.map((feature) => String(feature.properties.Notes ?? "").trim()).filter(Boolean))];
  return {
    service,
    season,
    year: Number(starts[0].slice(0, 4)),
    start: starts[0],
    end: ends[ends.length - 1],
    notes,
    zones: built,
  };
}

/** The season under way or coming up next; if both are over, the more recent one. */
function pickSeason(seasons, todayIso) {
  const upcoming = seasons.filter((season) => season.end >= todayIso).sort((a, b) => a.start.localeCompare(b.start));
  if (upcoming.length > 0) return upcoming[0];
  return [...seasons].sort((a, b) => b.end.localeCompare(a.end))[0];
}

async function main() {
  const now = new Date();
  const today = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const seasons = [];
  for (const source of SOURCES) {
    try {
      const season = await loadSeason(source, today);
      console.log(
        `${source.service}: ${season.season} ${season.year}, ${season.zones.length} zones, ${season.start} to ${season.end}`,
      );
      seasons.push(season);
    } catch (error) {
      console.warn(`${source.service}: skipped (${error.message})`);
    }
  }
  if (seasons.length === 0) throw new Error("Couldn't read either yard waste service.");
  const chosen = pickSeason(seasons, iso(today));
  const label = `${chosen.season === "fall" ? "Fall" : "Spring"} ${chosen.year}`;
  console.log(`Using ${label} (${chosen.service}).`);

  const output = {
    meta: {
      season: chosen.season,
      year: chosen.year,
      label,
      start: chosen.start,
      end: chosen.end,
      notes: chosen.notes,
      sourceUrl: `${SERVICE_ROOT}/${chosen.service}/MapServer`,
      cityMapUrl: CITY_MAP_URL,
      cityPageUrl: CITY_PAGE_URL,
      cityEmailListUrl: CITY_EMAIL_LIST_URL,
    },
    zones: chosen.zones.map(({ geometry, ...zone }) => zone),
    geojson: {
      type: "FeatureCollection",
      features: chosen.zones.map((zone) => ({
        type: "Feature",
        properties: { id: zone.id, color: zone.color },
        geometry: zone.geometry,
      })),
    },
  };

  const previous = await readFile(OUTPUT, "utf8").catch(() => null);
  const changed = await writeIfChanged(OUTPUT, `${JSON.stringify(output)}\n`);
  if (changed) {
    await markDatasetUpdated("yardWaste", { season: label });
    console.log(`${previous ? "Updated" : "Wrote"} ${path.relative(process.cwd(), OUTPUT)}.`);
  } else {
    console.log("No changes.");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
