"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  ALL_ZONE_CODES,
  DISTRICTS,
  SelectionState,
  ZoneDistrict,
  ZoneSubgroup,
  districtSelectionState,
  subgroupSelectionState,
  toggleCode,
  toggleDistrict,
  toggleSubgroup,
} from "@/lib/zoning";

interface FilterBarProps {
  activeCodes: Set<string>;
  onChange: (codes: Set<string>) => void;
  disabled?: boolean;
}

// ─── Pill styles ──────────────────────────────────────────────────────────────

function pillClasses(state: SelectionState, color: string) {
  if (state === "all") return { bg: color, border: "transparent", text: "#1b2b3c" };
  if (state === "partial") return { bg: `${color}33`, border: color, text: "#374151" };
  return { bg: "#fff", border: "#e5e7eb", text: "#9ca3af" };
}

// ─── Individual code chip ─────────────────────────────────────────────────────

function CodeChip({
  code,
  description,
  color,
  active,
  onToggle,
}: {
  code: string;
  description: string;
  color: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={description}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all hover:opacity-90"
      style={
        active
          ? { backgroundColor: color, borderColor: "transparent", color: "#1b2b3c" }
          : { backgroundColor: "#fff", borderColor: "#e5e7eb", color: "#9ca3af" }
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: active ? "rgba(0,0,0,0.3)" : color }}
      />
      {code}
    </button>
  );
}

// ─── Subgroup row ─────────────────────────────────────────────────────────────

function SubgroupRow({
  subgroup,
  activeCodes,
  color,
  onChange,
}: {
  subgroup: ZoneSubgroup;
  activeCodes: Set<string>;
  color: string;
  onChange: (codes: Set<string>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const state = subgroupSelectionState(subgroup, activeCodes);
  const styles = pillClasses(state, color);
  const multiCode = subgroup.codes.length > 1;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        {/* Subgroup toggle pill */}
        <button
          onClick={() => onChange(toggleSubgroup(subgroup, activeCodes))}
          title={subgroup.description}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:opacity-90"
          style={{
            backgroundColor: styles.bg,
            borderColor: styles.border,
            color: styles.text,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: state !== "none" ? color : "#d1d5db" }}
          />
          {subgroup.label}
        </button>

        {/* Expand toggle (only if there are multiple codes) */}
        {multiCode && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ChevronDown
              className="w-3.5 h-3.5 transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
        )}
      </div>

      {/* Individual codes (only shown when expanded; single-code subgroups use the pill directly) */}
      {expanded && (
        <div className="flex flex-wrap gap-1.5 pl-3 border-l-2" style={{ borderColor: `${color}55` }}>
          {subgroup.codes.map(({ code, description }) => (
            <CodeChip
              key={code}
              code={code}
              description={description}
              color={color}
              active={activeCodes.has(code)}
              onToggle={() => onChange(toggleCode(code, activeCodes))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── District dropdown panel ──────────────────────────────────────────────────

function DistrictPanel({
  district,
  activeCodes,
  onChange,
}: {
  district: ZoneDistrict;
  activeCodes: Set<string>;
  onChange: (codes: Set<string>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 min-w-56">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {district.label}
      </div>
      {district.subgroups.map((sg) => (
        <SubgroupRow
          key={sg.id}
          subgroup={sg}
          activeCodes={activeCodes}
          color={district.color}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

// ─── District pill ────────────────────────────────────────────────────────────

function DistrictPill({
  district,
  activeCodes,
  onChange,
}: {
  district: ZoneDistrict;
  activeCodes: Set<string>;
  onChange: (codes: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const state = districtSelectionState(district, activeCodes);
  const styles = pillClasses(state, district.color);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div
        className="flex items-center rounded-full border transition-all text-xs font-medium overflow-hidden"
        style={{
          backgroundColor: styles.bg,
          borderColor: styles.border,
          color: styles.text,
        }}
      >
        {/* Main toggle area */}
        <button
          onClick={() => onChange(toggleDistrict(district, activeCodes))}
          className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 hover:opacity-80 transition-opacity"
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: state !== "none" ? district.color : "#d1d5db" }}
          />
          {district.shortLabel}
        </button>

        {/* Divider + expand chevron */}
        <div
          className="w-px self-stretch"
          style={{ backgroundColor: state !== "none" ? `${district.color}66` : "#f3f4f6" }}
        />
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-2 py-1.5 hover:opacity-80 transition-opacity"
          aria-label={`Expand ${district.label}`}
        >
          <ChevronDown
            className="w-3.5 h-3.5 transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
      </div>

      {/* Floating panel */}
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl border border-gray-100 shadow-xl min-w-max">
          <DistrictPanel
            district={district}
            activeCodes={activeCodes}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

export default function FilterBar({ activeCodes, onChange, disabled }: FilterBarProps) {
  const allActive = activeCodes.size === ALL_ZONE_CODES.length;

  return (
    <div className={`flex items-center gap-2 flex-wrap transition-opacity duration-150 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      {/* All toggle */}
      <button
        onClick={() =>
          allActive ? onChange(new Set()) : onChange(new Set(ALL_ZONE_CODES))
        }
        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          allActive
            ? "bg-gray-900 text-white border-gray-900"
            : "bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600"
        }`}
      >
        All
      </button>

      {DISTRICTS.map((district) => (
        <DistrictPill
          key={district.id}
          district={district}
          activeCodes={activeCodes}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
