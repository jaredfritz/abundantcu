import { dataUpdated, type Dataset } from "@/lib/dataUpdates";

/** A small, muted "Updated <date>" line for data cards and pages. */
export function DataUpdated({ dataset, prefix = "Updated", className = "" }: { dataset: Dataset; prefix?: string; className?: string }) {
  return (
    <p className={`text-xs text-slate-500 ${className}`}>
      {prefix} {dataUpdated(dataset)}
    </p>
  );
}
