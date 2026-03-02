"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ALL_ZONE_CODES, ZoneFeatureProperties } from "@/lib/zoning";
import { GeocodedAddress, findZoneAtPoint } from "@/lib/geo";
import { BuildType } from "@/lib/buildTypes";
import FilterBar from "./FilterBar";
import ZonePanel from "./ZonePanel";
import AddressSearch from "./AddressSearch";
import BuildFilter from "./BuildFilter";

const ZoningMap = dynamic(() => import("./ZoningMap"), { ssr: false });

interface ZoningClientProps {
  data: GeoJSON.FeatureCollection;
}

export default function ZoningClient({ data }: ZoningClientProps) {
  const [activeCodes, setActiveCodes] = useState<Set<string>>(
    new Set(ALL_ZONE_CODES)
  );
  const [selectedFeature, setSelectedFeature] = useState<GeoJSON.Feature<
    GeoJSON.Geometry,
    ZoneFeatureProperties
  > | null>(null);
  const [searchPin, setSearchPin] = useState<{ lat: number; lng: number } | null>(null);
  const [activeBuild, setActiveBuild] = useState<BuildType | null>(null);

  function handleSearchResult(result: GeocodedAddress) {
    setSearchPin({ lat: result.lat, lng: result.lng });
    // Find which zone the address falls in and select it
    const zone = findZoneAtPoint(data, result.lng, result.lat);
    setSelectedFeature(
      zone as GeoJSON.Feature<GeoJSON.Geometry, ZoneFeatureProperties> | null
    );
  }

  function handleSearchClear() {
    setSearchPin(null);
    setSelectedFeature(null);
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-5 py-3 bg-white border-b border-gray-100 shadow-sm z-20">
        <div className="flex-shrink-0">
          <h1 className="text-base font-semibold text-gray-900 leading-tight">
            Champaign Zoning
          </h1>
          <p className="text-xs text-gray-400">{data.features.length.toLocaleString()} zones</p>
        </div>
        <div className="h-5 w-px bg-gray-200 flex-shrink-0" />
        <FilterBar activeCodes={activeCodes} onChange={setActiveCodes} disabled={activeBuild !== null} />
        <BuildFilter activeBuild={activeBuild} onChange={setActiveBuild} />
        <div className="ml-auto flex-shrink-0">
          <AddressSearch onResult={handleSearchResult} onClear={handleSearchClear} />
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative">
          <ZoningMap
            data={data}
            activeCodes={activeCodes}
            activeBuild={activeBuild}
            selectedId={selectedFeature?.properties?.OBJECTID ?? null}
            onSelectFeature={setSelectedFeature}
            searchPin={searchPin}
          />
        </div>

        <aside
          className="bg-white border-l border-gray-100 shadow-sm flex-shrink-0 overflow-hidden transition-all duration-200"
          style={{ width: selectedFeature ? "20rem" : 0 }}
        >
          <ZonePanel
            feature={selectedFeature}
            onClose={() => setSelectedFeature(null)}
          />
        </aside>
      </div>
    </div>
  );
}
