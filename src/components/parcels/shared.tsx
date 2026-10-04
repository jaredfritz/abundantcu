"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { MapLayerMouseEvent } from "react-map-gl/maplibre";
import type { Parcel, Parcels } from "@/lib/parcels";
import { ALL_COUNTY, areaLabel, CU_METRO } from "@/lib/parcels";

export const toggleClass = (active: boolean) =>
  `rounded-[4px] px-3 py-1.5 text-xs font-medium transition-colors ${
    active ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
  }`;

const TABS = [
  { href: "/data/value-per-acre", label: "Value Per Acre" },
  { href: "/data/vacant-land", label: "Vacant Land" },
];

/** Page title with tabs between the parcel maps. The selected area carries over between tabs. */
export function ParcelPageHeader({ title, description }: { title: string; description: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const area = searchParams.get("area");
  return (
    <div className="mb-8">
      <nav aria-label="Parcel data views" className="mb-5 flex gap-2 text-sm font-medium">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={area ? `${tab.href}?area=${encodeURIComponent(area)}` : tab.href}
            aria-current={pathname === tab.href ? "page" : undefined}
            className={
              pathname === tab.href
                ? "rounded-[4px] bg-[var(--color-primary)] px-3 py-1.5 text-white"
                : "rounded-[4px] border border-[var(--color-border)] bg-white px-3 py-1.5 hover:bg-slate-50"
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <h1 className="text-3xl font-extrabold md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-700 md:text-base">{description}</p>
    </div>
  );
}

export function AreaSelect({
  data,
  value,
  onChange,
}: {
  data: Parcels;
  value: string;
  onChange: (area: string) => void;
}) {
  return (
    <>
      <label htmlFor="parcel-area" className="sr-only">
        Area
      </label>
      <select
        id="parcel-area"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[4px] border border-[var(--color-border)] bg-white px-2 py-1.5 text-sm"
      >
        <option value={CU_METRO}>{areaLabel(CU_METRO)}</option>
        <option value={ALL_COUNTY}>{areaLabel(ALL_COUNTY)}</option>
        <optgroup label="Municipality">
          {data.cities
            .filter((city) => city.name !== "Unincorporated")
            .map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
        </optgroup>
        <option value="Unincorporated">Unincorporated areas</option>
      </select>
    </>
  );
}

/** Popup class that enlarges MapLibre's close button (styled in globals.css). */
export const PARCEL_POPUP_CLASS = "parcel-popup";

export interface ParcelSelection {
  parcel: Parcel;
  lngLat: [number, number];
}

/**
 * Click handling shared by the parcel maps. While a popup is open, a click elsewhere on the map only
 * closes it; the next click selects a parcel. This keeps a stray click from jumping to another parcel.
 */
export function useParcelSelection(data: Parcels) {
  const [selected, setSelected] = useState<ParcelSelection | null>(null);
  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      if (selected) {
        setSelected(null);
        return;
      }
      const index = event.features?.[0]?.properties?.i;
      if (typeof index === "number") {
        setSelected({ parcel: data.parcels[index], lngLat: [event.lngLat.lng, event.lngLat.lat] });
      }
    },
    [data, selected],
  );
  return { selected, setSelected, handleClick };
}
