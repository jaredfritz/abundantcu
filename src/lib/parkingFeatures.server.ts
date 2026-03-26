import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ParkingExportFeature, ParkingFeatureType } from "@/lib/parkingExport";

interface ParkingFeatureRow {
  id: string;
  type: string;
  name: string | null;
  coordinates: unknown;
  created_by: string;
  created_by_name: string;
}

function isFeatureType(value: string): value is ParkingFeatureType {
  return value === "surface" || value === "garage";
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sanitizeRing(value: unknown): [number, number][] | null {
  if (!Array.isArray(value)) return null;
  const points: [number, number][] = [];
  for (const point of value) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const lng = toFiniteNumber(point[0]);
    const lat = toFiniteNumber(point[1]);
    if (lng === null || lat === null) continue;
    points.push([lng, lat]);
  }

  if (points.length < 3) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const isClosed = first[0] === last[0] && first[1] === last[1];
  if (!isClosed) {
    points.push([first[0], first[1]]);
  }
  return points.length >= 4 ? points : null;
}

function sanitizeCoordinates(value: unknown): [number, number][][] | null {
  if (!Array.isArray(value)) return null;
  const rings: [number, number][][] = [];
  for (const maybeRing of value) {
    const ring = sanitizeRing(maybeRing);
    if (ring) rings.push(ring);
  }
  return rings.length > 0 ? rings : null;
}

function sanitizeFeature(row: ParkingFeatureRow): ParkingExportFeature | null {
  if (!row.id || !isFeatureType(row.type)) return null;
  const coordinates = sanitizeCoordinates(row.coordinates);
  if (!coordinates) return null;

  return {
    id: row.id,
    type: row.type,
    name: row.name,
    coordinates,
    created_by: row.created_by,
    created_by_name: row.created_by_name,
  };
}

export interface ParkingFeatureLoadResult {
  features: ParkingExportFeature[];
  error: string | null;
}

export async function loadParkingFeaturesForCapture(): Promise<ParkingFeatureLoadResult> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("parking_features")
      .select("id,type,name,coordinates,created_by,created_by_name")
      .order("created_at", { ascending: true });

    if (error) {
      return { features: [], error: error.message || "Unable to load parking features." };
    }

    const rows = (data ?? []) as ParkingFeatureRow[];
    const features: ParkingExportFeature[] = rows
      .map(sanitizeFeature)
      .filter((feature): feature is ParkingExportFeature => feature !== null);

    if (features.length === 0) {
      return { features, error: "No parking features returned for export." };
    }

    return { features, error: null };
  } catch (error) {
    return {
      features: [],
      error: error instanceof Error ? error.message : "Unable to load parking features.",
    };
  }
}
