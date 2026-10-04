// Vacant land categories for /data/vacant-land, from Champaign County property class codes.

import type { Parcel } from "./parcels";

export type VacantType = "residential" | "commercial" | "industrial" | "subdivision";

/** Champaign County property classes the assessor uses for vacant land. */
export const VACANT_CLASS_TYPES: Record<string, VacantType> = {
  "0030": "residential",
  "0050": "commercial",
  "0081": "industrial",
  // "10-30" classes: platted subdivision land assessed at its pre-subdivision (usually farmland) value
  // until it's built on or sold, under 35 ILCS 200/10-30.
  "0032": "subdivision",
  "0052": "subdivision",
  "0062": "subdivision",
  "0072": "subdivision",
  "0082": "subdivision",
};

export function vacantTypeFor(useCode: string): VacantType | null {
  return VACANT_CLASS_TYPES[useCode] ?? null;
}

export const VACANT_TYPES: { id: VacantType; label: string; color: string; description: string }[] = [
  {
    id: "residential",
    label: "Vacant residential lot",
    color: "#2a78d6",
    description: "Empty lots zoned or classed for homes.",
  },
  {
    id: "commercial",
    label: "Vacant commercial lot",
    color: "#eb6834",
    description: "Empty lots classed for commercial use.",
  },
  {
    id: "industrial",
    label: "Vacant industrial land",
    color: "#1baf7a",
    description: "Empty land classed for industrial use.",
  },
  {
    id: "subdivision",
    label: "Vacant, subdivision rate (10-30)",
    color: "#9c3e94",
    description:
      "Platted subdivision land assessed at its pre-subdivision value, usually farmland rates, until it's built on " +
      "or sold (35 ILCS 200/10-30).",
  },
];

export const OTHER_PARCEL_COLOR = "#dcdcdc";

export function vacantTypeConfig(type: VacantType) {
  return VACANT_TYPES.find((entry) => entry.id === type) ?? VACANT_TYPES[0];
}

export interface VacantTypeSummary {
  type: VacantType;
  parcels: number;
  acres: number;
  value: number;
}

export interface VacantSummary {
  parcels: number;
  acres: number;
  value: number;
  /** All parcel acres in the area, for "share of land" */
  areaAcres: number;
  byType: VacantTypeSummary[];
  largest: Parcel[];
}

export function summarizeVacant(parcels: Parcel[], largestCount = 20): VacantSummary {
  const byType = new Map<VacantType, VacantTypeSummary>();
  const vacant: Parcel[] = [];
  let areaAcres = 0;
  for (const parcel of parcels) {
    areaAcres += parcel.acres;
    if (!parcel.vacantType) continue;
    vacant.push(parcel);
    const group = byType.get(parcel.vacantType) ?? { type: parcel.vacantType, parcels: 0, acres: 0, value: 0 };
    group.parcels += 1;
    group.acres += parcel.acres;
    group.value += parcel.marketValue ?? 0;
    byType.set(parcel.vacantType, group);
  }
  const groups = VACANT_TYPES.map((entry) => byType.get(entry.id)).filter((group): group is VacantTypeSummary =>
    Boolean(group),
  );
  return {
    parcels: vacant.length,
    acres: groups.reduce((sum, group) => sum + group.acres, 0),
    value: groups.reduce((sum, group) => sum + group.value, 0),
    areaAcres,
    byType: groups,
    largest: [...vacant].sort((a, b) => b.acres - a.acres).slice(0, largestCount),
  };
}
