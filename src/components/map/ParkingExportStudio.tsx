"use client";

import { useMemo, useState } from "react";
import ParkingMapper from "@/components/tools/ParkingMapper";
import type { ParkingBasemap, ParkingLegendConfig, ParkingStyleOverrides } from "@/lib/parkingExport";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function ParkingExportStudio() {
  const [widthPx, setWidthPx] = useState(1600);
  const [heightPx, setHeightPx] = useState(1200);
  const [dpr, setDpr] = useState(2);
  const [basemap, setBasemap] = useState<ParkingBasemap>("roadmap");
  const [tiltOn, setTiltOn] = useState(false);
  const [borderRatio, setBorderRatio] = useState(0.04);
  const [roadLabelBoost, setRoadLabelBoost] = useState(0);

  const [surfaceFill, setSurfaceFill] = useState("#ef4444");
  const [surfaceBorder, setSurfaceBorder] = useState("#b91c1c");
  const [garageFill, setGarageFill] = useState("#f97316");
  const [garageBorder, setGarageBorder] = useState("#c2410c");

  const [legendEnabled, setLegendEnabled] = useState(false);
  const [legendTitle, setLegendTitle] = useState("Parking Inventory");
  const [legendXPct, setLegendXPct] = useState(0.03);
  const [legendYPct, setLegendYPct] = useState(0.74);
  const [legendWidthPct, setLegendWidthPct] = useState(0.3);
  const [legendBackgroundColor, setLegendBackgroundColor] = useState("rgba(255,255,255,0.94)");
  const [legendBorderColor, setLegendBorderColor] = useState("rgba(17,24,39,0.16)");
  const [legendTextColor, setLegendTextColor] = useState("#1f2937");

  const [filename, setFilename] = useState("parking-map-export.png");
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const styleOverrides = useMemo<ParkingStyleOverrides>(
    () => ({
      surfaceFill,
      surfaceBorder,
      garageFill,
      garageBorder,
    }),
    [garageBorder, garageFill, surfaceBorder, surfaceFill]
  );

  const legendConfig = useMemo<ParkingLegendConfig>(
    () => ({
      enabled: legendEnabled,
      title: legendTitle,
      xPct: legendXPct,
      yPct: legendYPct,
      widthPct: legendWidthPct,
      backgroundColor: legendBackgroundColor,
      borderColor: legendBorderColor,
      textColor: legendTextColor,
    }),
    [
      legendBackgroundColor,
      legendBorderColor,
      legendEnabled,
      legendTextColor,
      legendTitle,
      legendWidthPct,
      legendXPct,
      legendYPct,
    ]
  );

  const previewKey = useMemo(
    () =>
      [
        basemap,
        tiltOn ? "tilt" : "flat",
        borderRatio.toFixed(4),
        roadLabelBoost,
        surfaceFill,
        surfaceBorder,
        garageFill,
        garageBorder,
        legendEnabled ? "legend-on" : "legend-off",
        legendTitle,
        legendXPct.toFixed(3),
        legendYPct.toFixed(3),
        legendWidthPct.toFixed(3),
        legendBackgroundColor,
        legendBorderColor,
        legendTextColor,
      ].join("|"),
    [
      basemap,
      borderRatio,
      garageBorder,
      garageFill,
      legendBackgroundColor,
      legendBorderColor,
      legendEnabled,
      legendTextColor,
      legendTitle,
      legendWidthPct,
      legendXPct,
      legendYPct,
      roadLabelBoost,
      surfaceBorder,
      surfaceFill,
      tiltOn,
    ]
  );

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
          borderRatio,
          roadLabelBoost,
          styleOverrides,
          legendConfig,
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
    <div className="mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Parking Capture Studio</h1>
        <p className="mt-1 text-xs text-slate-600">
          Export high-resolution screenshots of `/data/parking`.
        </p>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
                onChange={(event) =>
                  setWidthPx(clamp(Number.parseInt(event.target.value || "0", 10), 800, 6000))
                }
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
                onChange={(event) =>
                  setHeightPx(clamp(Number.parseInt(event.target.value || "0", 10), 800, 6000))
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              />
            </div>
          </div>

          <div>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="parking-export-border">
                Border (%)
              </label>
              <input
                id="parking-export-border"
                type="number"
                min={0}
                max={18}
                step={0.5}
                value={Number((borderRatio * 100).toFixed(1))}
                onChange={(event) =>
                  setBorderRatio(clamp(Number.parseFloat(event.target.value || "0") / 100, 0, 0.18))
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Minimum map margin around all parking polygons.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="parking-export-road-label-boost">
                Road Label Boost
              </label>
              <input
                id="parking-export-road-label-boost"
                type="number"
                min={0}
                max={8}
                step={1}
                value={roadLabelBoost}
                onChange={(event) =>
                  setRoadLabelBoost(clamp(Number.parseInt(event.target.value || "0", 10), 0, 8))
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colors</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Surface Fill</label>
                <input type="color" value={surfaceFill} onChange={(event) => setSurfaceFill(event.target.value)} className="h-9 w-full rounded border border-slate-300" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Surface Border</label>
                <input type="color" value={surfaceBorder} onChange={(event) => setSurfaceBorder(event.target.value)} className="h-9 w-full rounded border border-slate-300" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Garage Fill</label>
                <input type="color" value={garageFill} onChange={(event) => setGarageFill(event.target.value)} className="h-9 w-full rounded border border-slate-300" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Garage Border</label>
                <input type="color" value={garageBorder} onChange={(event) => setGarageBorder(event.target.value)} className="h-9 w-full rounded border border-slate-300" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={legendEnabled} onChange={(event) => setLegendEnabled(event.target.checked)} />
              Show legend
            </label>
            {legendEnabled && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Legend Title</label>
                  <input
                    type="text"
                    value={legendTitle}
                    onChange={(event) => setLegendTitle(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">X (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={95}
                      step={1}
                      value={Math.round(legendXPct * 100)}
                      onChange={(event) => setLegendXPct(clamp(Number.parseFloat(event.target.value || "0") / 100, 0, 0.95))}
                      className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Y (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={95}
                      step={1}
                      value={Math.round(legendYPct * 100)}
                      onChange={(event) => setLegendYPct(clamp(Number.parseFloat(event.target.value || "0") / 100, 0, 0.95))}
                      className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Width (%)</label>
                    <input
                      type="number"
                      min={12}
                      max={95}
                      step={1}
                      value={Math.round(legendWidthPct * 100)}
                      onChange={(event) =>
                        setLegendWidthPct(clamp(Number.parseFloat(event.target.value || "0") / 100, 0.12, 0.95))
                      }
                      className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Background</label>
                    <input
                      type="text"
                      value={legendBackgroundColor}
                      onChange={(event) => setLegendBackgroundColor(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Border</label>
                    <input
                      type="text"
                      value={legendBorderColor}
                      onChange={(event) => setLegendBorderColor(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Text</label>
                    <input
                      type="text"
                      value={legendTextColor}
                      onChange={(event) => setLegendTextColor(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

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
        <div className="relative aspect-[4/3] w-full bg-slate-100">
          <div className="absolute inset-0">
            <ParkingMapper
              key={previewKey}
              editMode={false}
              captureMode
              captureFillParent
              initialBasemap={basemap}
              initialTilt={tiltOn}
              roadLabelBoost={roadLabelBoost}
              fitToFeaturesBorderRatio={borderRatio}
              styleOverrides={styleOverrides}
              captureLegendConfig={legendConfig}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
