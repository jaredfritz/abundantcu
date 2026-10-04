"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Parcels } from "@/lib/parcels";
import {
  ALL_COUNTY,
  areaCities,
  areaLabel,
  boundsOf,
  CU_METRO,
  formatAcres,
  formatMoney,
  inArea,
  loadParcels,
  summarize,
} from "@/lib/parcels";
import {
  COLOR_SCALES,
  MAP_METRICS,
  metricConfig,
  supportsAverageScale,
  type ColorScale,
  type ParcelMetric,
} from "@/lib/parcelMapStyles";
import { cardClass, ErrorBlock, LoadingBlock } from "@/components/crashes/shared";
import { LandUseTable } from "./LandUseTable";
import { ParcelMap } from "./ParcelMap";

const toggleClass = (active: boolean) =>
  `rounded-[4px] px-3 py-1.5 text-xs font-medium transition-colors ${
    active ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
  }`;

export default function ValuePerAcreDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Parcels | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadParcels().then(setData, (err: Error) => setError(err.message));
  }, []);

  const area = searchParams.get("area") ?? CU_METRO;
  const metric = (MAP_METRICS.some((m) => m.id === searchParams.get("metric"))
    ? searchParams.get("metric")
    : "value") as ParcelMetric;
  const scale: ColorScale = searchParams.get("scale") === "average" ? "average" : "bands";
  // 3D is the default: height makes the gap between city cores and the rest of town clearest.
  const is3D = searchParams.get("view") !== "2d";
  const showVacant = searchParams.get("vacant") === "1";

  const updateParams = (
    next: Partial<{ area: string; metric: ParcelMetric; scale: ColorScale; is3D: boolean; showVacant: boolean }>,
  ) => {
    const state = { area, metric, scale, is3D, showVacant, ...next };
    const params = new URLSearchParams();
    if (state.area !== CU_METRO) params.set("area", state.area);
    if (state.metric !== "value") params.set("metric", state.metric);
    if (state.scale !== "bands") params.set("scale", state.scale);
    if (!state.is3D) params.set("view", "2d");
    if (state.showVacant) params.set("vacant", "1");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const filtered = useMemo(() => (data ? data.parcels.filter((parcel) => inArea(parcel, area)) : []), [data, area]);
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const cities = useMemo(() => areaCities(area), [area]);
  const bounds = useMemo(() => (data ? boundsOf(data, area) : null), [data, area]);
  const config = metricConfig(metric);
  // The "vs. area average" scale compares each parcel to the selected area's value per taxable acre.
  // Farmland is left out of the baseline, since it's assessed on productivity rather than market value.
  const average = useMemo(() => {
    const farm = summary.byLandUse.find((group) => group.landUse === "Farm");
    const acres = summary.taxableAcres - (farm?.acres ?? 0);
    const total = summary.value - (farm?.value ?? 0);
    return acres > 0 ? total / acres : null;
  }, [summary]);

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold md:text-4xl">Value Per Acre</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700 md:text-base">
          How much property value and property tax every acre of Champaign County produces. Compact, walkable blocks
          pay far more per acre than parking lots, strip development, and vacant land, and they cost less to serve.
        </p>
      </div>

      {error && <ErrorBlock message={error} />}

      {!data && !error && <LoadingBlock label="Loading 78,000 parcels..." height="h-[640px]" />}

      {data && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <label htmlFor="parcel-area" className="sr-only">
              Area
            </label>
            <select
              id="parcel-area"
              value={area}
              onChange={(event) => updateParams({ area: event.target.value })}
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

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Map metric">
              {MAP_METRICS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={metric === option.id}
                  onClick={() => updateParams({ metric: option.id })}
                  className={toggleClass(metric === option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {supportsAverageScale(config) && (
              <>
                <label htmlFor="parcel-scale" className="sr-only">
                  Color scale
                </label>
                <select
                  id="parcel-scale"
                  value={scale}
                  onChange={(event) => updateParams({ scale: event.target.value as ColorScale })}
                  className="rounded-[4px] border border-[var(--color-border)] bg-white px-2 py-1.5 text-sm"
                >
                  {COLOR_SCALES.map((option) => (
                    <option key={option.id} value={option.id}>
                      Color: {option.label}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className="flex gap-1.5" role="group" aria-label="Map view">
              <button type="button" aria-pressed={!is3D} onClick={() => updateParams({ is3D: false })} className={toggleClass(!is3D)}>
                2D
              </button>
              <button type="button" aria-pressed={is3D} onClick={() => updateParams({ is3D: true })} className={toggleClass(is3D)}>
                3D
              </button>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showVacant}
                onChange={(event) => updateParams({ showVacant: event.target.checked })}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Outline vacant land
            </label>
          </div>

          <SummaryCards summary={summary} />

          <div className={`${cardClass} mt-8 p-4 md:p-6`}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                {config.label} · {areaLabel(area)}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {config.description}{" "}
                {scale === "average" && supportsAverageScale(config) && average !== null
                  ? `Red parcels produce less per acre than the ${areaLabel(area)} average of ${formatMoney(average, { compact: true })} (excluding farmland); blue parcels produce more. `
                  : ""}
                Click any parcel for details.
              </p>
            </div>
            <ParcelMap
              data={data}
              metric={metric}
              scale={scale}
              average={average}
              cities={cities} bounds={bounds} is3D={is3D} showVacant={showVacant} />
          </div>

          <div className={`${cardClass} mt-8 p-4 md:p-6`}>
            <h2 className="text-xl font-semibold">Land Use · {areaLabel(area)}</h2>
            <p className="mt-1 mb-4 text-sm text-slate-600">
              Compare each land use&apos;s share of the land with its share of the tax base. Uses that take up more land
              than they pay for lean on the rest.
            </p>
            <LandUseTable summary={summary} />
          </div>

          <MethodologyNote data={data} />
        </>
      )}
    </section>
  );
}

function SummaryCards({ summary }: { summary: ReturnType<typeof summarize> }) {
  const metrics = [
    { label: "Market value (est.)", value: formatMoney(summary.value, { compact: true }) },
    { label: "Property tax before exemptions", value: formatMoney(summary.tax, { compact: true }) },
    {
      label: "Average value per taxable acre",
      value: formatMoney(summary.taxableAcres > 0 ? summary.value / summary.taxableAcres : null, { compact: true }),
    },
    {
      label: "Vacant land",
      value: `${formatAcres(summary.vacantAcres)} acres`,
      detail: `${summary.vacantParcels.toLocaleString()} parcels`,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className={`${cardClass} p-4`}>
          <p className="text-sm text-slate-600">{metric.label}</p>
          <p className="text-2xl font-bold tabular-nums text-[var(--color-primary)]">{metric.value}</p>
          {metric.detail && <p className="text-xs text-slate-500">{metric.detail}</p>}
        </div>
      ))}
    </div>
  );
}

function MethodologyNote({ data }: { data: Parcels }) {
  const { meta } = data;
  const updated = new Date(meta.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="mt-8 space-y-2 text-xs text-slate-600">
      <h2 className="text-sm font-semibold text-[var(--color-primary)]">How this map is made</h2>
      <p>
        <strong>Market value</strong> is three times each parcel&apos;s equalized assessed value (EAV), since Illinois
        assesses property at one-third of market value outside Cook County. Farmland is assessed on what it can produce,
        not its sale price, so farmland is shown in its own tan color instead of on the value scale and is left out of
        the area average. <strong>Property tax</strong> is EAV times the
        parcel&apos;s {meta.taxYear} tax code rate, before homestead and other exemptions, so it overstates bills for
        owner-occupied homes. <strong>Land share</strong> uses the assessor&apos;s land and building split. Exempt
        property (government, schools, churches, the University) has no assessed value and is shown with gray hatching.
        Condominium units in one building are combined so the building&apos;s value sits on its land once. Wind and solar
        lease areas drawn over farm parcels are left out to avoid double counting.
      </p>
      <p>
        Data: parcel boundaries and assessments from the{" "}
        <a href={meta.parcelSourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Champaign County GIS Consortium via City of Champaign GIS
        </a>
        ; tax rates from the{" "}
        <a href={meta.rateSourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Champaign County Clerk&apos;s {meta.taxYear} rate book
        </a>
        ; site addresses from the{" "}
        <a href={meta.addressSourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Champaign County property tax inquiry
        </a>
        . Municipalities come from each parcel&apos;s tax code. Updated {updated}. Values are estimates for illustration,
        not official tax bills.
      </p>
      <p>
        Adapted from the open-source{" "}
        <a
          href="https://github.com/StrongTownsChicago/chicago-value-per-acre"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Value Per Acre map
        </a>{" "}
        by{" "}
        <a href="https://www.strongtownschicago.org/value-per-acre-map" target="_blank" rel="noopener noreferrer" className="underline">
          Strong Towns Chicago
        </a>{" "}
        (MIT license).
      </p>
    </div>
  );
}
