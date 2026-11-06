import type { DrainsResponse } from "@/lib/adoptADrain";
import { fetchAllDrains } from "@/lib/adoptADrain.server";
import { cityError, json } from "@/lib/adoptADrainHttp.server";

// Every drain in the City's Adopt-a-Drain layer. The CDN keeps it for a minute; the page updates drains you act on
// right away without waiting for this.
export async function GET() {
  try {
    const body: DrainsResponse = { drains: await fetchAllDrains(), fetchedAt: Date.now() };
    return json(body, 200, { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" });
  } catch (err) {
    return cityError(err);
  }
}
