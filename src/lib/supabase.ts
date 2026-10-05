import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Supabase is optional: without it the site builds and runs, and only the parking map is unavailable. */
export const supabaseConfigured = Boolean(url && key);

// Placeholder values keep the client defined (and the build working) when Supabase isn't configured; nothing calls
// it then, because the parking map checks `supabaseConfigured` first.
export const supabase = createClient(url || "http://localhost:54321", key || "not-configured");

// ─── Types matching the database schema ───────────────────────────────────────

export interface DbParkingFeature {
  id: string;
  type: "surface" | "garage";
  name: string | null;
  coordinates: [number, number][][]; // closed GeoJSON ring [[lng,lat],...]
  created_by: string;      // auth.uid() UUID — used for RLS ownership
  created_by_name: string; // display name — shown in UI / GeoJSON export
  created_at: string;
}
