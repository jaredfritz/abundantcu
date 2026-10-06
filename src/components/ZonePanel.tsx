"use client";

import { X } from "lucide-react";
import { BuildType } from "@/lib/buildTypes";
import { SelectedPermit } from "@/lib/permits";
import { countyParcelUrl, displayAddress, formatAcres, formatPin, propertyClassLabel } from "@/lib/parcels";
import type { ZoningParcel } from "@/lib/zoningParcels";
import {
  ZoneFeatureProperties,
  ZONE_DETAILS,
  areaToAcres,
  getZoneDescription,
  getZoneDistrict,
} from "@/lib/zoning";

interface ZonePanelProps {
  feature: GeoJSON.Feature<GeoJSON.Geometry, ZoneFeatureProperties> | null;
  parcel?: ZoningParcel | null;
  /** Tax year for the county parcel link */
  taxYear?: number | null;
  permit: SelectedPermit | null;
  activeBuild: BuildType | null;
  showPermitSourceNote?: boolean;
  onClose: () => void;
}

type CafeRestrictionNote = {
  section: string;
  summary: string;
};

type FourplexRestrictionNote = {
  section: string;
  summary: string;
};

const CAFE_RESTRICTION_NOTES: Record<string, CafeRestrictionNote> = {
  MF3: {
    section: "Sec. 37-249",
    summary:
      "Accessory-only restaurant use with floor-area, placement, display, and loading/separation limits.",
  },
  CO: {
    section: "Sec. 37-250",
    summary:
      "Restaurant limits on size, operating hours, liquor license class, spacing, and outdoor sound.",
  },
  CI: {
    section: "Sec. 37-250",
    summary:
      "Restaurant limits on size, operating hours, liquor license class, spacing, and outdoor sound.",
  },
  IBP: {
    section: "Sec. 37-250",
    summary:
      "Restaurant limits on size, operating hours, liquor license class, spacing, and outdoor sound.",
  },
  I1: {
    section: "Sec. 37-261",
    summary:
      "Only within a 200+ acre contiguous I1/I2 district, with one restaurant allowed per large district.",
  },
  I2: {
    section: "Sec. 37-261",
    summary:
      "Only within a 200+ acre contiguous I1/I2 district, with one restaurant allowed per large district.",
  },
};

const FOURPLEX_RESTRICTION_NOTES: Record<string, FourplexRestrictionNote> = {
  CN: {
    section: "Sec. 37-59.3(f)",
    summary:
      "Multifamily is provisional and no dwelling units are allowed below the second story.",
  },
  CG: {
    section: "Sec. 37-60.3(d)",
    summary:
      "Multifamily is provisional with ground-floor residential limits on total area and street-facing frontage.",
  },
  CB1: {
    section: "Sec. 37-61.3(e) + Sec. 37-262",
    summary:
      "Multifamily is provisional and must meet CB ground-floor residential restrictions, including frontage limits along core streets in this district.",
  },
  CB2: {
    section: "Sec. 37-62.3(e) + Sec. 37-262",
    summary:
      "Multifamily is provisional and must meet CB ground-floor residential restrictions, including frontage limits along core streets in this district.",
  },
  CB3: {
    section: "Sec. 37-63.3(e) + Sec. 37-262",
    summary:
      "Multifamily is provisional and must meet CB ground-floor residential restrictions, including frontage limits along core streets in this district.",
  },
  IBP: {
    section: "Sec. 37-65.3(c)",
    summary:
      "Multifamily is provisional and no dwelling units are allowed below the second story.",
  },
};

export default function ZonePanel({
  feature,
  parcel = null,
  taxYear = null,
  permit,
  activeBuild,
  showPermitSourceNote = false,
  onClose,
}: ZonePanelProps) {
  if (!feature && !parcel && !permit) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-400">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">Click a parcel to see details</p>
      </div>
    );
  }

  if (permit) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-lg flex-shrink-0 mt-0.5"
              style={{ backgroundColor: permit.buildingType === "MF" ? "#B9387A" : "#1F6CB0" }}
            />
            <div>
              <div className="text-xl font-bold text-gray-900 break-words leading-tight">{permit.address}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 space-y-1">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Permit Details</div>
          <Row label="Permit_No" value={permit.permitNo} />
          <Row label="Year" value={permit.year ?? "—"} />
          <Row label="Building_Type" value={permit.buildingType} />
          <Row label="Units" value={permit.units ?? "—"} />
          <Row label="Zone code" value={permit.zoneCodeLabel} />
          <div className="py-1.5 border-b border-gray-50">
            <span className="text-sm text-gray-500">Description</span>
            <div className="text-sm text-gray-800 mt-0.5 leading-relaxed">{permit.zoneDescription}</div>
          </div>
        </div>

        <div className="px-5 py-4 mt-auto border-t border-gray-100">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Data Sources
          </div>
          <div className="flex flex-col gap-1.5 text-sm text-gray-700">
            <div>
              Champaign zoning map data{" "}
              <a
                href="https://gis-cityofchampaign.opendata.arcgis.com/datasets/a24e403a9fa245dbaaaf46f766860c40_15/explore?location=40.113600%2C-88.308850%2C13"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                here
              </a>
              .
            </div>
            <div>
              Champaign zoning ordinances{" "}
              <a
                href="https://library.municode.com/il/champaign/codes/code_of_ordinances?nodeId=MUCO_CH37ZO"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                here
              </a>
              .
            </div>
            {showPermitSourceNote && <div>Permit data provided by the City of Champaign.</div>}
          </div>
        </div>
      </div>
    );
  }

  const zoneCode = parcel ? parcel.zone : feature!.properties.zoning_code;
  const props = { zoning_code: zoneCode };
  const district = getZoneDistrict(zoneCode);
  const description = getZoneDescription(zoneCode);
  const color = district?.color ?? "#d1d5db";
  // The city's layer names this field SHAPESTArea; older exports used "SHAPE.STArea()".
  const districtProps = feature?.properties as (ZoneFeatureProperties & { SHAPESTArea?: number }) | undefined;
  const area = districtProps ? (districtProps.SHAPESTArea ?? districtProps["SHAPE.STArea()"]) : 0;
  const cafeRestriction =
    activeBuild?.id === "cafe" ? CAFE_RESTRICTION_NOTES[zoneCode] : undefined;
  const fourplexRestriction =
    activeBuild?.id === "fourplex" ? FOURPLEX_RESTRICTION_NOTES[zoneCode] : undefined;
  const buildStatus = !activeBuild
    ? null
    : activeBuild.allowedCodes.includes(zoneCode)
      ? "Allowed by right"
      : activeBuild.provisionalCodes?.includes(zoneCode)
        ? "Provisional; restrictions apply"
        : activeBuild.notAllowedCodes.includes(zoneCode)
          ? "Not allowed"
          : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 mt-0.5"
            style={{ backgroundColor: color }}
          />
          {parcel ? (
            <div>
              <div className="text-xl font-bold text-gray-900 break-words leading-tight">
                {parcel.address ? displayAddress(parcel.address) : `Parcel ${formatPin(parcel.pin)}`}
              </div>
              <div className="text-sm text-gray-500 mt-0.5">
                {zoneCode} · {description}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xl font-bold text-gray-900">{props.zoning_code}</div>
              <div className="text-sm text-gray-500">{description}</div>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* District badge */}
      {district && (
        <div className="px-5 pt-4 pb-2">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: `${color}33`, color: "#1b2b3c" }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            {district.label}
          </span>
        </div>
      )}

      {/* Stats */}
      {parcel ? (
        <div className="px-5 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Lot size</div>
              <div className="text-lg font-semibold text-gray-900">{Math.round(parcel.sqft).toLocaleString()}</div>
              <div className="text-xs text-gray-400">sq ft{parcel.condoDevelopment ? " (approx.)" : ""}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Acres</div>
              <div className="text-lg font-semibold text-gray-900">{formatAcres(parcel.acres)}</div>
              <div className="text-xs text-gray-400">acres</div>
            </div>
          </div>
          {buildStatus && (
            <div className="rounded-xl border border-gray-200 px-3 py-2.5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{activeBuild!.label}</div>
              <div className="text-sm font-semibold text-gray-900">{buildStatus}</div>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                Based on the district alone. Lot size, setbacks, and other rules can still limit this lot.
              </p>
            </div>
          )}
          {parcel.secondaryZone && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 leading-relaxed">
              This parcel is split between districts: about {parcel.zoneShare}% {parcel.zone} and{" "}
              {parcel.secondaryZoneShare}% {parcel.secondaryZone}. It&apos;s shown as {parcel.zone}.
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 py-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">District area</div>
            <div className="text-lg font-semibold text-gray-900">{area ? areaToAcres(area) : "—"}</div>
            <div className="text-xs text-gray-400">acres</div>
          </div>
        </div>
      )}

      {parcel && (
        <div className="px-5 py-3 space-y-1">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Parcel</div>
          <Row label="Current use (county class)" value={propertyClassLabel(parcel.useCode)} />
          {parcel.units > 1 && (
            <Row
              label={parcel.condoDevelopment ? "Condo or townhome units" : "Condo units"}
              value={parcel.units}
            />
          )}
          <div className="py-1.5 border-b border-gray-50">
            <div className="text-sm text-gray-500">Parcel number</div>
            <a
              href={countyParcelUrl(parcel.pin, taxYear)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {formatPin(parcel.pin)}
            </a>
          </div>
          {parcel.condoDevelopment && (
            <p className="text-[11px] text-gray-500 pt-1 leading-relaxed">
              Condo and townhome units are mapped as building footprints; this lot&apos;s outline and size are
              reconstructed around them and approximate.
            </p>
          )}
        </div>
      )}

      {/* Details */}
      <div className="px-5 py-3 space-y-1">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Details</div>
        <Row label="Zone Code" value={props.zoning_code} />
        <div className="py-1.5 border-b border-gray-50">
          <span className="text-sm text-gray-500">Description</span>
          <div className="text-sm text-gray-800 mt-0.5 leading-relaxed">
            {ZONE_DETAILS[props.zoning_code] || "—"}
          </div>
        </div>
      </div>

      {cafeRestriction && (
        <div className="px-5 py-3">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Cafe Restrictions
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <div className="text-xs font-semibold text-amber-800">{cafeRestriction.section}</div>
            <p className="text-xs text-amber-900 mt-1 leading-relaxed">{cafeRestriction.summary}</p>
          </div>
        </div>
      )}
      {fourplexRestriction && (
        <div className="px-5 py-3">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Fourplex Restrictions
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <div className="text-xs font-semibold text-amber-800">{fourplexRestriction.section}</div>
            <p className="text-xs text-amber-900 mt-1 leading-relaxed">{fourplexRestriction.summary}</p>
          </div>
        </div>
      )}

      {/* Data Sources */}
      <div className="px-5 py-4 mt-auto border-t border-gray-100">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Data Sources
        </div>
        <div className="flex flex-col gap-1.5 text-sm text-gray-700">
          <div>
            Champaign zoning map data{" "}
            <a
              href="https://gis-cityofchampaign.opendata.arcgis.com/datasets/a24e403a9fa245dbaaaf46f766860c40_15/explore?location=40.113600%2C-88.308850%2C13"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              here
            </a>
            .
          </div>
          <div>
            Champaign zoning ordinances{" "}
            <a
              href="https://library.municode.com/il/champaign/codes/code_of_ordinances?nodeId=MUCO_CH37ZO"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              here
            </a>
            .
          </div>
          {parcel && <div>Parcels and lot sizes from the Champaign County GIS Consortium.</div>}
          {showPermitSourceNote && <div>Permit data provided by the City of Champaign.</div>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="py-1.5 border-b border-gray-50">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-800 break-words leading-relaxed mt-0.5">{value}</div>
    </div>
  );
}
