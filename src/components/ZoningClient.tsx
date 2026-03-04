"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ALL_ZONE_CODES, ZoneFeatureProperties } from "@/lib/zoning";
import { GeocodedAddress, findZoneAtPoint } from "@/lib/geo";
import { BuildType } from "@/lib/buildTypes";
import { SelectedPermit } from "@/lib/permits";
import FilterBar from "./FilterBar";
import ZonePanel from "./ZonePanel";
import AddressSearch from "./AddressSearch";
import BuildFilter from "./BuildFilter";

const ZoningMap = dynamic(() => import("./ZoningMap"), { ssr: false });

interface ZoningClientProps {
  data: GeoJSON.FeatureCollection;
  permitsData: GeoJSON.FeatureCollection;
}

export default function ZoningClient({ data, permitsData }: ZoningClientProps) {
  const [activeCodes, setActiveCodes] = useState<Set<string>>(
    new Set(ALL_ZONE_CODES)
  );
  const [selectedFeature, setSelectedFeature] = useState<GeoJSON.Feature<
    GeoJSON.Geometry,
    ZoneFeatureProperties
  > | null>(null);
  const [searchPin, setSearchPin] = useState<{ lat: number; lng: number } | null>(null);
  const [activeBuild, setActiveBuild] = useState<BuildType | null>(null);
  const [showPermits, setShowPermits] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState<SelectedPermit | null>(null);
  const hasPanelSelection = Boolean(selectedFeature || selectedPermit);

  function handleSearchResult(result: GeocodedAddress) {
    setSearchPin({ lat: result.lat, lng: result.lng });
    // Find which zone the address falls in and select it
    const zone = findZoneAtPoint(data, result.lng, result.lat);
    setSelectedPermit(null);
    setSelectedFeature(
      zone as GeoJSON.Feature<GeoJSON.Geometry, ZoneFeatureProperties> | null
    );
  }

  function handleSearchClear() {
    setSearchPin(null);
    setSelectedFeature(null);
    setSelectedPermit(null);
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50">
      {/* Top bar */}
      <header
        className="bg-white border-b border-gray-100 shadow-sm z-20"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Primary row */}
        <div className="flex items-start justify-between gap-3 md:gap-4 px-4 md:px-5 pt-3 pb-2">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 leading-tight">
              Champaign Zoning
            </h1>
            <p className="text-xs text-gray-400">{data.features.length.toLocaleString()} zones</p>
          </div>
          <div className="hidden md:block h-5 w-px bg-gray-200 flex-shrink-0" />
          {/* FilterBar inline on desktop */}
          <div className="hidden md:flex flex-1 min-w-0">
            <FilterBar activeCodes={activeCodes} onChange={setActiveCodes} disabled={activeBuild !== null} />
          </div>
          <div className="hidden md:flex ml-auto items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setShowPermits((v) => {
                  const next = !v;
                  if (next) {
                    // Default zoning layers off when permit layer is turned on.
                    setActiveBuild(null);
                    setActiveCodes(new Set());
                    setSelectedFeature(null);
                  } else {
                    setSelectedPermit(null);
                  }
                  return next;
                });
              }}
              className={`min-h-10 px-3 rounded-full text-xs font-medium border transition-colors ${
                showPermits
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:text-gray-800"
              }`}
            >
              Residential Permits
            </button>
            <BuildFilter activeBuild={activeBuild} onChange={setActiveBuild} />
            <AddressSearch onResult={handleSearchResult} onClear={handleSearchClear} />
          </div>
        </div>
        {/* Controls row on mobile */}
        <div className="md:hidden px-4 pb-2 flex items-start gap-2">
          <button
            onClick={() => {
              setShowPermits((v) => {
                const next = !v;
                if (next) {
                  setActiveBuild(null);
                  setActiveCodes(new Set());
                  setSelectedFeature(null);
                } else {
                  setSelectedPermit(null);
                }
                return next;
              });
            }}
            className={`min-h-10 px-3 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
              showPermits
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-white text-gray-600 border-gray-300"
            }`}
          >
            Permits
          </button>
          <BuildFilter activeBuild={activeBuild} onChange={setActiveBuild} />
          <div className="min-w-0 flex-1">
            <AddressSearch onResult={handleSearchResult} onClear={handleSearchClear} />
          </div>
        </div>
        {/* FilterBar on third row for mobile */}
        <div className="md:hidden px-4 pb-3">
          <FilterBar activeCodes={activeCodes} onChange={setActiveCodes} disabled={activeBuild !== null} />
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative">
          <ZoningMap
            data={data}
            activeCodes={activeCodes}
            activeBuild={activeBuild}
            permitsData={permitsData}
            showPermits={showPermits}
            selectedId={selectedFeature?.properties?.OBJECTID ?? null}
            onSelectFeature={(f) => {
              setSelectedPermit(null);
              setSelectedFeature(f);
            }}
            onSelectPermit={(p) => {
              setSelectedFeature(null);
              setSelectedPermit(p);
            }}
            searchPin={searchPin}
          />
        </div>

        <aside
          className="hidden md:block bg-white border-l border-gray-100 shadow-sm flex-shrink-0 overflow-hidden transition-all duration-200"
          style={{ width: hasPanelSelection ? "20rem" : 0 }}
        >
          <ZonePanel
            feature={selectedFeature}
            permit={selectedPermit}
            activeBuild={activeBuild}
            onClose={() => {
              setSelectedFeature(null);
              setSelectedPermit(null);
            }}
          />
        </aside>
      </div>

      {/* Mobile sheet panel */}
      {hasPanelSelection && (
        <>
          <button
            aria-label="Close details panel"
            className="md:hidden fixed inset-0 z-30 bg-black/30"
            onClick={() => {
              setSelectedFeature(null);
              setSelectedPermit(null);
            }}
          />
          <aside
            className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-100 shadow-2xl rounded-t-2xl overflow-hidden"
            style={{
              height: "min(66dvh, 34rem)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            <ZonePanel
              feature={selectedFeature}
              permit={selectedPermit}
              activeBuild={activeBuild}
              onClose={() => {
                setSelectedFeature(null);
                setSelectedPermit(null);
              }}
            />
          </aside>
        </>
      )}
    </div>
  );
}
