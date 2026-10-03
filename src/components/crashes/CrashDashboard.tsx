"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Crashes, DateRange } from "@/lib/crashes";
import { datePresets, inDateRange, loadCrashes, summarize, trends } from "@/lib/crashes";
import { CrashMap } from "./CrashMap";
import { MetricCards } from "./MetricCards";
import { TrendChart } from "./TrendChart";
import {
  cardClass,
  CrashPageHeader,
  DataSourceNote,
  DateRangeControls,
  ErrorBlock,
  LoadingBlock,
} from "./shared";

const TWO_YEARS_MS = 2 * 366 * 24 * 60 * 60 * 1000;

export default function CrashDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Crashes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCrashes().then(setData, (err: Error) => setError(err.message));
  }, []);

  // Default to the latest full year IDOT has published.
  const range: DateRange = useMemo(() => {
    const fallback = data ? datePresets(data.minDate, data.maxDate)[0].range : { start: "", end: "" };
    return {
      start: searchParams.get("start") ?? fallback.start,
      end: searchParams.get("end") ?? fallback.end,
    };
  }, [data, searchParams]);

  const setRange = (next: DateRange) => {
    const params = new URLSearchParams();
    if (next.start) params.set("start", next.start);
    if (next.end) params.set("end", next.end);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  const filtered = useMemo(() => (data ? data.crashes.filter((crash) => inDateRange(crash, range)) : []), [data, range]);
  const stats = useMemo(() => summarize(filtered), [filtered]);
  const interval =
    range.start && range.end && Date.parse(range.end) - Date.parse(range.start) > TWO_YEARS_MS ? "month" : "week";
  const trendData = useMemo(() => trends(filtered, range, interval), [filtered, range, interval]);

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <CrashPageHeader
        title="Champaign County Crash Dashboard"
        description="Every reported traffic crash in Champaign County, mapped. Filter by date to see patterns, trends, and where our streets are failing people."
      />

      {error && <ErrorBlock message={error} />}

      {!data && !error && <LoadingBlock label="Loading crash data..." height="h-40" />}

      {data && (
        <>
          <div className="mb-6">
            <DateRangeControls data={data} range={range} onChange={setRange} />
          </div>

          <MetricCards stats={stats} />

          <div className={`${cardClass} mt-8 p-6`}>
            <h2 className="mb-4 text-xl font-semibold">{interval === "week" ? "Weekly" : "Monthly"} Trends</h2>
            <TrendChart data={trendData} interval={interval} />
          </div>

          <div className={`${cardClass} mt-8 p-6`}>
            <h2 className="mb-4 text-xl font-semibold">Crash Locations</h2>
            <CrashMap crashes={filtered} />
          </div>

          <DataSourceNote data={data} />
        </>
      )}
    </section>
  );
}
