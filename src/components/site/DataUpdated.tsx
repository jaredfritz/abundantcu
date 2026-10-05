import { DATA_STATUS, type Dataset } from "@/lib/dataUpdates";

/** A small, muted line saying what a page's data covers and when it was last refreshed. */
export function DataUpdated({ dataset, className = "" }: { dataset: Dataset; className?: string }) {
  return <p className={`text-xs text-slate-500 ${className}`}>{DATA_STATUS[dataset]}</p>;
}
