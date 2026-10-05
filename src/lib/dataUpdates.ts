// When each dataset behind the /data maps was last updated. The data scripts keep their entries
// current (scripts/fetch-parcel-values.mjs, scripts/fetch-idot-crashes.mjs); zoning and permits are
// static files, so their dates are set by hand when those files change.
import updates from "@/data/data-updates.json";

export type Dataset = keyof typeof updates;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Oct 5, 2026", formatted by hand so the server and browser always render the same text
 * (locale formatting can differ between Node and browsers and break hydration).
 */
export function formatUpdateDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function dataUpdated(dataset: Dataset): string {
  return formatUpdateDate(updates[dataset]);
}
