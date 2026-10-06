"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, X } from "lucide-react";
import type { Parcel, Parcels } from "@/lib/parcels";
import {
  countyParcelUrl,
  displayAddress,
  formatAcres,
  formatMoney,
  formatPin,
  loadParcels,
  parcelAt,
  propertyClassLabel,
} from "@/lib/parcels";
import {
  CITY_LAYER_GROUPS,
  CITY_LAYER_IDS,
  CITY_LAYERS,
  layersAt,
  loadCityLayer,
  OPEN_DATA_SITE,
  type CityLayerData,
  type LayerMatch,
} from "@/lib/cityLayers";
import { DISTRICTS } from "@/lib/zoning";
import { DATA_STATUS } from "@/lib/dataUpdates";
import { cardClass, ErrorBlock } from "@/components/crashes/shared";
import { ParcelSearch } from "@/components/parcels/ParcelSearch";
import { ParcelSources, toggleClass } from "@/components/parcels/shared";
import { AboutDataLink, AboutThisData } from "@/components/site/AboutThisData";
import { CityMap, type ParcelStyle, type Spot } from "./CityMap";

const DEFAULT_LAYERS = ["zoning", "council-districts"];

const PARCEL_STYLES: { id: ParcelStyle; label: string }[] = [
  { id: "outline", label: "Outlines" },
  { id: "value", label: "Value per acre" },
  { id: "off", label: "Off" },
];

export default function CityMapExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [parcels, setParcels] = useState<Parcels | null>(null);
  const [parcelError, setParcelError] = useState<string | null>(null);
  const [layerData, setLayerData] = useState<Record<string, CityLayerData>>({});
  const [layerError, setLayerError] = useState<string | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);

  const layersParam = searchParams.get("layers");
  const active = useMemo(() => {
    const ids = layersParam === null ? DEFAULT_LAYERS : layersParam.split(",");
    return new Set(ids.filter((id) => CITY_LAYER_IDS.includes(id)));
  }, [layersParam]);
  const parcelStyle = (PARCEL_STYLES.some((style) => style.id === searchParams.get("parcels"))
    ? searchParams.get("parcels")
    : "outline") as ParcelStyle;

  const updateParams = (next: Partial<{ active: Set<string>; parcelStyle: ParcelStyle }>) => {
    const state = { active, parcelStyle, ...next };
    const params = new URLSearchParams();
    // Keep the layers in list order so the same set always makes the same link.
    const ids = CITY_LAYER_IDS.filter((id) => state.active.has(id));
    if (ids.join(",") !== DEFAULT_LAYERS.join(",")) params.set("layers", ids.join(","));
    if (state.parcelStyle !== "outline") params.set("parcels", state.parcelStyle);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const toggleLayer = (id: string) => {
    const next = new Set(active);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateParams({ active: next });
  };

  useEffect(() => {
    loadParcels().then(setParcels, (err: Error) => setParcelError(err.message));
  }, []);

  const load = useCallback((ids: string[]) => {
    for (const id of ids) {
      loadCityLayer(id).then(
        (data) => setLayerData((current) => (current[id] ? current : { ...current, [id]: data })),
        (err: Error) => setLayerError(err.message),
      );
    }
  }, []);

  // Load the layers that are on; once a spot is picked, load them all for the "At this location" panel.
  useEffect(() => {
    load(spot ? CITY_LAYER_IDS : [...active]);
  }, [active, spot, load]);

  const pick = useCallback((lng: number, lat: number) => setSpot({ lng, lat, key: Date.now() }), []);
  const showParcel = (parcel: Parcel) => {
    const ring = parcels?.geojson.features[parcel.index].geometry.coordinates[0][0] ?? [];
    // A vertex average lands inside nearly every parcel shape and gives the panel a point to look up.
    const [lng, lat] = ring
      .reduce(([x, y], [px, py]) => [x + px, y + py], [0, 0])
      .map((sum) => sum / Math.max(ring.length, 1));
    setSpot({ lng, lat, parcel, key: Date.now() });
  };

  const spotParcel = useMemo(() => {
    if (!spot || !parcels) return null;
    return spot.parcel ?? parcelAt(parcels, spot.lng, spot.lat);
  }, [spot, parcels]);

  const allLoaded = CITY_LAYER_IDS.every((id) => layerData[id]);
  const matches = useMemo(() => {
    if (!spot || !allLoaded) return null;
    return layersAt(
      CITY_LAYERS.map((layer) => ({ layer, data: layerData[layer.id] })),
      spot.lng,
      spot.lat,
    );
  }, [spot, allLoaded, layerData]);

  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-10 md:px-8 md:py-14">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold md:text-4xl">Champaign City Map</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700 md:text-base">
          Every zoning layer and city boundary the City of Champaign publishes, on top of every parcel in the county.
          Turn layers on and off, then click anywhere to see its zoning, districts, and parcel details in one place.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {DATA_STATUS.cityLayers} · {DATA_STATUS.parcels} · <AboutDataLink />
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {parcels ? (
          <ParcelSearch data={parcels} onSelect={showParcel} />
        ) : (
          <div className="flex h-9 w-72 items-center gap-2 rounded-[4px] border border-[var(--color-border)] bg-white px-3 text-sm text-slate-500">
            {parcelError ? (
              "Parcel search unavailable"
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading 78,000 parcels...
              </>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Parcels">
          <span className="mr-1 text-xs font-medium text-slate-600">Parcels:</span>
          {PARCEL_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              aria-pressed={parcelStyle === style.id}
              onClick={() => updateParams({ parcelStyle: style.id })}
              className={toggleClass(parcelStyle === style.id)}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {parcelError && <ErrorBlock message={parcelError} />}
      {layerError && <ErrorBlock message={layerError} />}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* The map comes first on phones, so it isn't below the long layer list; on wide screens the list sits left. */}
        <div className={`${cardClass} p-2 md:p-3 lg:order-2`}>
          <CityMap
            parcels={parcels}
            parcelStyle={parcelStyle}
            active={active}
            layerData={layerData}
            spot={spot}
            selectedParcel={spotParcel}
            onPick={pick}
          >
            {spot && (
              <LocationPanel
                parcel={spotParcel}
                parcelsLoading={!parcels && !parcelError}
                taxYear={parcels?.meta.taxYear ?? null}
                matches={matches}
                onClose={() => setSpot(null)}
              />
            )}
          </CityMap>
          {!spot && <p className="px-1 pt-2 text-xs text-slate-500">Click anywhere on the map to see what&apos;s there.</p>}
        </div>
        <LayerList
          active={active}
          onToggle={toggleLayer}
          onSet={(ids) => updateParams({ active: new Set(ids) })}
          loading={[...active].filter((id) => !layerData[id])}
        />
      </div>

      <MethodologyNote parcels={parcels} />
    </section>
  );
}

function LayerList({
  active,
  onToggle,
  onSet,
  loading,
}: {
  active: Set<string>;
  onToggle: (id: string) => void;
  onSet: (ids: string[]) => void;
  loading: string[];
}) {
  return (
    <div className={`${cardClass} p-4 lg:order-1 lg:max-h-[710px] lg:overflow-y-auto`}>
      {CITY_LAYER_GROUPS.map((group) => {
        const layers = CITY_LAYERS.filter((layer) => layer.group === group.id);
        const ids = layers.map((layer) => layer.id);
        const allOn = ids.every((id) => active.has(id));
        return (
          <fieldset key={group.id} className="mb-5 last:mb-0">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{group.label}</legend>
              <button
                type="button"
                onClick={() =>
                  onSet(allOn ? [...active].filter((id) => !ids.includes(id)) : [...new Set([...active, ...ids])])
                }
                className="text-xs text-[var(--color-accent-secondary)] underline"
              >
                {allOn ? "Hide all" : "Show all"}
              </button>
            </div>
            <ul className="space-y-1">
              {layers.map((layer) => (
                <li key={layer.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-[4px] px-1.5 py-1 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={active.has(layer.id)}
                      onChange={() => onToggle(layer.id)}
                      className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--color-primary)]"
                    />
                    <LayerSwatch style={layer.style} color={layer.color} zoning={layer.id === "zoning"} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        {layer.label}
                        {loading.includes(layer.id) && <Loader2 className="h-3 w-3 animate-spin text-slate-400" aria-label="Loading" />}
                      </span>
                      <span className="block text-xs leading-snug text-slate-500">{layer.description}</span>
                    </span>
                  </label>
                  {layer.id === "zoning" && active.has("zoning") && <ZoningLegend />}
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}

function LayerSwatch({ style, color, zoning }: { style: string; color: string; zoning: boolean }) {
  const base = "mt-1 h-3.5 w-3.5 shrink-0";
  if (zoning) {
    return (
      <span
        aria-hidden
        className={`${base} rounded-[2px]`}
        style={{ background: `linear-gradient(135deg, ${DISTRICTS.map((district) => district.color).join(", ")})` }}
      />
    );
  }
  if (style === "point") {
    return <span aria-hidden className={`${base} rounded-full border-2 border-white`} style={{ backgroundColor: color }} />;
  }
  if (style === "boundary") {
    return <span aria-hidden className={`${base} rounded-[2px] border-2 border-dashed`} style={{ borderColor: color }} />;
  }
  return (
    <span
      aria-hidden
      className={`${base} rounded-[2px] border-2`}
      style={{ borderColor: color, backgroundColor: `${color}38` }}
    />
  );
}

function ZoningLegend() {
  return (
    <ul className="mb-1 ml-[52px] mt-0.5 space-y-0.5">
      {DISTRICTS.map((district) => (
        <li key={district.id} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: district.color }} />
          {district.shortLabel}
        </li>
      ))}
    </ul>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function LocationPanel({
  parcel,
  parcelsLoading,
  taxYear,
  matches,
  onClose,
}: {
  parcel: Parcel | null;
  parcelsLoading: boolean;
  taxYear: number | null;
  matches: LayerMatch[] | null;
  onClose: () => void;
}) {
  // Council districts cover the whole city, so a spot outside all of them is outside Champaign.
  const inCity = matches?.some((match) => match.layer.id === "council-districts" && match.features.length > 0);
  const found = matches?.filter((match) => match.features.length > 0) ?? [];
  const notIn = matches?.filter((match) => match.features.length === 0 && match.layer.notIn) ?? [];

  return (
    <div className="absolute inset-x-2 bottom-2 top-auto max-h-[55%] overflow-y-auto rounded-[4px] border border-[var(--color-border)] bg-white/95 p-4 shadow-lg backdrop-blur-sm sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-auto sm:max-h-[calc(100%-24px)] sm:w-80">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">At this location</h2>
        <button type="button" onClick={onClose} className="-mr-1 -mt-1 rounded-[4px] p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 border-b border-slate-200 pb-3">
        {parcel ? (
          <>
            <p className="text-base font-bold text-[var(--color-primary)]">
              {parcel.address ? displayAddress(parcel.address) : `Parcel ${formatPin(parcel.pin)}`}
            </p>
            <p className="text-xs text-slate-500">
              {parcel.city} · {propertyClassLabel(parcel.useCode)}
            </p>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-slate-500">Value (est.)</dt>
                <dd className="font-semibold">{parcel.exempt ? "Exempt" : formatMoney(parcel.marketValue, { compact: true })}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Per acre</dt>
                <dd className="font-semibold">{formatMoney(parcel.valuePerAcre, { compact: true })}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Acres</dt>
                <dd className="font-semibold">{formatAcres(parcel.acres)}</dd>
              </div>
            </dl>
            <a
              href={countyParcelUrl(parcel.pin, taxYear)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-semibold text-[var(--color-accent-secondary)] underline"
            >
              County record for {formatPin(parcel.pin)} ↗
            </a>
          </>
        ) : (
          <p className="text-sm text-slate-500">{parcelsLoading ? "Loading parcels..." : "No parcel here (likely a street or right-of-way)."}</p>
        )}
      </div>

      {!matches ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading city layers...
        </p>
      ) : !inCity ? (
        <p className="mt-3 text-sm text-slate-600">
          Outside the City of Champaign. The city&apos;s zoning and district layers only cover Champaign.
        </p>
      ) : (
        <>
          <dl className="mt-1 divide-y divide-slate-100">
            {found.map(({ layer, features }) => (
              <Row key={layer.id} label={layer.itemLabel}>
                {features.map((feature, index) => (
                  <div key={index} className={index > 0 ? "mt-1.5" : ""}>
                    <span className="font-semibold">{feature.value}</span>
                    {feature.detail && <span className="block text-xs text-slate-600">{feature.detail}</span>}
                    {feature.link && (
                      <a
                        href={feature.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--color-accent-secondary)] underline"
                      >
                        {feature.link.label} ↗
                      </a>
                    )}
                  </div>
                ))}
              </Row>
            ))}
          </dl>
          {notIn.length > 0 && (
            <p className="mt-2 border-t border-slate-200 pt-2 text-xs leading-snug text-slate-500">
              Not in {listOf(notIn.map((match) => match.layer.notIn as string))}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function listOf(items: string[]): string {
  if (items.length <= 2) return items.join(" or ");
  return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;
}

function MethodologyNote({ parcels }: { parcels: Parcels | null }) {
  return (
    <AboutThisData
      credit={
        <>
          City layers from the{" "}
          <a href={OPEN_DATA_SITE} target="_blank" rel="noopener noreferrer" className="underline">
            City of Champaign Open Data site
          </a>
          , provided as is, without warranty.
        </>
      }
    >
      <p>
        <strong>City layers</strong> are the zoning and boundary layers the City of Champaign publishes on its open data
        site: zoning districts, planned developments, special use permits, historic landmarks and districts, annexation
        agreements, mitigation plans, council districts, police districts and beats, planning areas, registered
        neighborhood organizations, TIF districts, the enterprise zone, special service areas, and fire stations. They
        cover the City of Champaign only. Linked case documents are hosted by the city. Manufactured home community
        zoning, labeled MHP in the city&apos;s data, is shown as MHC, its name in the zoning ordinance.
      </p>
      <p>
        <strong>At this location</strong> lists every city layer at the point you click, whether or not the layer is
        turned on, and the nearest fire station in a straight line (not driving distance or response area). Boundaries
        are as precise as the city&apos;s shapes; on a line between two districts, check with the city.
      </p>
      <p>
        <strong>Parcels</strong> and their values come from the same countywide dataset as{" "}
        <a href="/data/value-per-acre" className="underline">
          Value Per Acre
        </a>
        : market value is three times equalized assessed value, an estimate rather than an appraisal.
      </p>
      {parcels && <ParcelSources meta={parcels.meta} />}
    </AboutThisData>
  );
}
