import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

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
