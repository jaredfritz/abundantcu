import { listTeams } from "@/lib/adoptADrain.server";
import { cityError, json } from "@/lib/adoptADrainHttp.server";

// Team names already in the City's program, so new volunteers can join an existing team by its exact name.
export async function GET() {
  try {
    const { field, names } = await listTeams();
    return json({ enabled: Boolean(field), names }, 200, {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    });
  } catch (err) {
    return cityError(err);
  }
}
