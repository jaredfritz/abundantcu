"use client";

import { useMemo, useState } from "react";

type Basemap = "roadmap" | "satellite";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function ParkingExportStudio() {
  const [widthPx, setWidthPx] = useState(1600);
  const [heightPx, setHeightPx] = useState(1200);
  const [dpr, setDpr] = useState(2);
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [tiltOn, setTiltOn] = useState(false);
  const [filename, setFilename] = useState("parking-map-export.png");
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    const params = new URLSearchParams({
      basemap,
      tilt: tiltOn ? "1" : "0",
      capture: "1",
    });
    return `/data/parking/print?${params.toString()}`;
  }, [basemap, tiltOn]);

  const megapixels = useMemo(() => {
    return (Math.round(widthPx) * Math.round(heightPx)) / 1_000_000;
  }, [heightPx, widthPx]);

  async function exportScreenshot() {
    setIsExporting(true);
    setStatus("Generating screenshot...");

    try {
      const response = await fetch("/api/parking-map-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widthPx,
          heightPx,
          dpr,
          basemap,
          tilt: tiltOn,
          filename,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Export failed (${response.status}).`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename.trim() || "parking-map-export.png";
      link.click();
      URL.revokeObjectURL(objectUrl);

      setStatus("Screenshot exported.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Parking Capture Studio</h1>
        <p className="mt-1 text-xs text-slate-600">
          Export high-resolution screenshots of `/data/parking`.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="parking-export-width">
              Width (px)
            </label>
            <input
              id="parking-export-width"
              type="number"
              min={800}
              max={6000}
              step={50}
              value={widthPx}
              onChange={(event) => setWidthPx(clamp(Number.parseInt(event.target.value || "0", 10), 800, 6000))}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="parking-export-height">
              Height (px)
            </label>
            <input
              id="parking-export-height"
              type="number"
              min={800}
              max={6000}
              step={50}
              value={heightPx}
              onChange={(event) => setHeightPx(clamp(Number.parseInt(event.target.value || "0", 10), 800, 6000))}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="parking-export-dpr">
              Device Pixel Ratio
            </label>
            <input
              id="parking-export-dpr"
              type="number"
              min={1}
              max={4}
              step={0.25}
              value={dpr}
              onChange={(event) => setDpr(clamp(Number.parseFloat(event.target.value || "0"), 1, 4))}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="parking-export-basemap">
              Basemap
            </label>
            <select
              id="parking-export-basemap"
              value={basemap}
              onChange={(event) => setBasemap(event.target.value === "roadmap" ? "roadmap" : "satellite")}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            >
              <option value="satellite">Satellite</option>
              <option value="roadmap">Map</option>
            </select>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={tiltOn} onChange={(event) => setTiltOn(event.target.checked)} />
            Enable Tilt
          </label>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="parking-export-filename">
              Filename
            </label>
            <input
              id="parking-export-filename"
              type="text"
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Output: {Math.round(widthPx)} x {Math.round(heightPx)} px ({megapixels.toFixed(1)} MP), DPR {dpr.toFixed(2)}
        </p>

        <button
          onClick={() => {
            void exportScreenshot();
          }}
          disabled={isExporting}
          className="mt-4 w-full rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? "Exporting..." : "Export Screenshot"}
        </button>

        {status && <p className="mt-2 text-xs text-slate-600">{status}</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
          <span>Preview</span>
          <span>{Math.round(widthPx)} x {Math.round(heightPx)} @ {dpr.toFixed(2)}x</span>
        </div>
        <div className="aspect-[4/3] w-full bg-slate-100">
          <iframe
            key={previewUrl}
            src={previewUrl}
            title="Parking export preview"
            className="h-full w-full border-0"
            loading="lazy"
          />
        </div>
      </section>
    </div>
  );
}
