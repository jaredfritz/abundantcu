"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Parcel, Parcels } from "@/lib/parcels";
import {
  areaCities,
  areaLabel,
  boundsOf,
  countyParcelUrl,
  CU_METRO,
  formatAcres,
  formatMoney,
  formatPin,
  inArea,
  loadParcels,
  titleCaseAddress,
} from "@/lib/parcels";
import { summarizeVacant, vacantTypeConfig, VACANT_TYPES, type VacantSummary } from "@/lib/vacant";
import { cardClass, ErrorBlock, LoadingBlock } from "@/components/crashes/shared";
import { AreaSelect, ParcelPageHeader } from "./shared";
import { VacantLandMap } from "./VacantLandMap";

const th = "px-2 py-3 text-xs font-medium uppercase tracking-wider text-slate-500";
const td = "px-2 py-2 text-right text-sm tabular-nums";

export default function VacantLandDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Parcels | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ parcel: Parcel; key: number } | null>(null);
  const mapSection = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadParcels().then(setData, (err: Error) => setError(err.message));
  }, []);

  const area = searchParams.get("area") ?? CU_METRO;
  const setArea = (next: string) => {
    router.replace(next === CU_METRO ? pathname : `${pathname}?area=${encodeURIComponent(next)}`, { scroll: false });
  };

  const filtered = useMemo(() => (data ? data.parcels.filter((parcel) => inArea(parcel, area)) : []), [data, area]);
  const summary = useMemo(() => summarizeVacant(filtered), [filtered]);
  const cities = useMemo(() => areaCities(area), [area]);
  const bounds = useMemo(() => (data ? boundsOf(data, area) : null), [data, area]);

  const showOnMap = (parcel: Parcel) => {
    setFocus({ parcel, key: Date.now() });
    mapSection.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <ParcelPageHeader
        title="Vacant Land"
        description="Every parcel the county assessor classes as vacant land. Empty lots in town are places new homes and businesses could go, and land that produces almost nothing while the city still maintains the streets and pipes around it."
      />

      {error && <ErrorBlock message={error} />}

      {!data && !error && <LoadingBlock label="Loading 78,000 parcels..." height="h-[640px]" />}

      {data && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <AreaSelect data={data} value={area} onChange={setArea} />
          </div>

          <SummaryCards summary={summary} />

          <div ref={mapSection} className={`${cardClass} mt-8 scroll-mt-4 p-4 md:p-6`}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Vacant Land · {areaLabel(area)}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Vacant parcels by type. Everything else is shown in gray for context. Click any parcel for details.
              </p>
            </div>
            <VacantLandMap data={data} cities={cities} bounds={bounds} focus={focus} />
          </div>

          <div className={`${cardClass} mt-8 p-4 md:p-6`}>
            <h2 className="text-xl font-semibold">Vacant Land by Type · {areaLabel(area)}</h2>
            <TypeTable summary={summary} />
          </div>

          <div className={`${cardClass} mt-8 p-4 md:p-6`}>
            <h2 className="text-xl font-semibold">Largest Vacant Parcels · {areaLabel(area)}</h2>
            <p className="mt-1 mb-4 text-sm text-slate-600">Click a row to see the parcel on the map.</p>
            <LargestTable parcels={summary.largest} taxYear={data.meta.taxYear} onSelect={showOnMap} />
          </div>

          <MethodologyNote />
        </>
      )}
    </section>
  );
}

function SummaryCards({ summary }: { summary: VacantSummary }) {
  const subdivision = summary.byType.find((group) => group.type === "subdivision");
  const metrics = [
    { label: "Vacant parcels", value: summary.parcels.toLocaleString() },
    {
      label: "Vacant acres",
      value: formatAcres(summary.acres),
      detail: `${summary.areaAcres > 0 ? Math.round((summary.acres / summary.areaAcres) * 100) : 0}% of parcel land`,
    },
    { label: "Market value (est.)", value: formatMoney(summary.value, { compact: true }) },
    {
      label: "Assessed at subdivision rate (10-30)",
      value: `${formatAcres(subdivision?.acres ?? 0)} acres`,
      detail: subdivision ? `${formatMoney(subdivision.value / subdivision.acres, { compact: true })} per acre` : undefined,
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

function TypeTable({ summary }: { summary: VacantSummary }) {
  if (summary.parcels === 0) {
    return <div className="py-8 text-center text-slate-500">No vacant parcels in this area</div>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className={`${th} text-left`}>Type</th>
            <th className={`${th} text-right`}>Parcels</th>
            <th className={`${th} text-right`}>Acres</th>
            <th className={`${th} text-right`}>Market value (est.)</th>
            <th className={`${th} text-right`}>Value per acre</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {summary.byType.map((group, index) => {
            const config = vacantTypeConfig(group.type);
            return (
              <tr key={group.type} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="px-2 py-2 text-sm">
                  <span className="flex items-start gap-2">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-[2px]" style={{ backgroundColor: config.color }} />
                    <span>
                      <span className="font-medium">{config.label}</span>
                      <span className="block text-xs text-slate-500">{config.description}</span>
                    </span>
                  </span>
                </td>
                <td className={td}>{group.parcels.toLocaleString()}</td>
                <td className={td}>{formatAcres(group.acres)}</td>
                <td className={td}>{formatMoney(group.value, { compact: true })}</td>
                <td className={td}>{formatMoney(group.acres > 0 ? group.value / group.acres : null, { compact: true })}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--color-border)] font-semibold">
            <td className="px-2 py-2 text-sm">Total</td>
            <td className={td}>{summary.parcels.toLocaleString()}</td>
            <td className={td}>{formatAcres(summary.acres)}</td>
            <td className={td}>{formatMoney(summary.value, { compact: true })}</td>
            <td className={td}>{formatMoney(summary.acres > 0 ? summary.value / summary.acres : null, { compact: true })}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function LargestTable({
  parcels,
  taxYear,
  onSelect,
}: {
  parcels: Parcel[];
  taxYear: number | null;
  onSelect: (parcel: Parcel) => void;
}) {
  if (parcels.length === 0) {
    return <div className="py-8 text-center text-slate-500">No vacant parcels in this area</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className={`${th} text-left`}>Parcel</th>
            <th className={`${th} text-left`}>Type</th>
            <th className={`${th} text-right`}>Acres</th>
            <th className={`${th} text-right`}>Value per acre</th>
            <th className={`${th} text-right`}>County record</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {parcels.map((parcel, index) => {
            const config = parcel.vacantType ? vacantTypeConfig(parcel.vacantType) : VACANT_TYPES[0];
            return (
              <tr
                key={parcel.pin}
                onClick={() => onSelect(parcel)}
                className={`cursor-pointer hover:bg-slate-100 ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
              >
                <td className="px-2 py-2 text-sm">
                  <button type="button" onClick={() => onSelect(parcel)} className="text-left font-medium hover:underline">
                    {parcel.address ? titleCaseAddress(parcel.address) : `Parcel ${formatPin(parcel.pin)}`}
                  </button>
                  <span className="block text-xs text-slate-500">{parcel.city}</span>
                </td>
                <td className="px-2 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-[2px]" style={{ backgroundColor: config.color }} />
                    {config.label.replace(/^Vacant,? /, "").replace(/^\w/, (c) => c.toUpperCase())}
                  </span>
                </td>
                <td className={td}>{formatAcres(parcel.acres)}</td>
                <td className={td}>{formatMoney(parcel.valuePerAcre, { compact: true })}</td>
                <td className={td}>
                  <a
                    href={countyParcelUrl(parcel.pin, taxYear)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="text-[var(--color-accent-secondary)] underline"
                  >
                    {formatPin(parcel.pin)} ↗
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MethodologyNote() {
  return (
    <div className="mt-8 space-y-2 text-xs text-slate-600">
      <h2 className="text-sm font-semibold text-[var(--color-primary)]">About this data</h2>
      <p>
        Vacant land is every parcel the Champaign County assessor classes as vacant (residential, commercial, or
        industrial vacant land, plus the &ldquo;10-30&rdquo; subdivision classes). <strong>Surface parking lots are not
        included</strong>: the assessor classes them as improved commercial property. See the{" "}
        <Link href="/data/parking" className="underline">
          parking map
        </Link>{" "}
        for those. Exempt vacant land, such as city- or university-owned lots, is not counted.
      </p>
      <p>
        <strong>Subdivision rate (10-30):</strong> under 35 ILCS 200/10-30, land that has been platted into a
        subdivision keeps its pre-subdivision assessment, usually farmland rates, until a lot is built on or sold. That
        is why these parcels show values of a few thousand dollars per acre while ordinary vacant lots nearby are
        valued in the hundreds of thousands.
      </p>
      <p>
        Market value is three times the equalized assessed value. Values and sources are the same as the{" "}
        <Link href="/data/value-per-acre" className="underline">
          Value Per Acre
        </Link>{" "}
        map; see its notes for details.
      </p>
    </div>
  );
}
