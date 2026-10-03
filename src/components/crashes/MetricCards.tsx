import type { CrashStats } from "@/lib/crashes";
import { cardClass } from "./shared";

export function MetricCards({ stats }: { stats: CrashStats }) {
  const metrics = [
    { label: "Total Crashes", value: stats.totalCrashes, color: "text-[var(--color-primary)]" },
    { label: "Total Injuries", value: stats.totalInjuries, color: "text-orange-600" },
    { label: "Fatalities", value: stats.totalFatalities, color: "text-red-600" },
    { label: "Pedestrian Crashes", value: stats.pedestrianCrashes, color: "text-blue-700" },
    { label: "Bicycle Crashes", value: stats.bicycleCrashes, color: "text-green-700" },
    { label: "Hit & Run", value: stats.hitAndRunCount, color: "text-purple-700" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {metrics.map((metric) => (
        <div key={metric.label} className={`${cardClass} p-4`}>
          <p className="text-sm text-slate-600">{metric.label}</p>
          <p className={`text-2xl font-bold tabular-nums ${metric.color}`}>{metric.value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
