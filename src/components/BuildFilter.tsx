"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { BUILD_TYPES, BuildType } from "@/lib/buildTypes";

interface BuildFilterProps {
  activeBuild: BuildType | null;
  onChange: (build: BuildType | null) => void;
}

export default function BuildFilter({ activeBuild, onChange }: BuildFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      {activeBuild ? (
        /* Active state — shows selected build type with clear button */
        <div className="flex items-center rounded-full border text-xs font-medium overflow-hidden min-h-10"
          style={{ backgroundColor: "#0072B2", borderColor: "#0072B2", color: "#fff" }}
        >
          <button
            onClick={() => setOpen((v) => !v)}
            className="min-h-10 flex items-center gap-1.5 pl-3 pr-2 py-1.5 hover:opacity-80 transition-opacity"
          >
            <span className="w-2 h-2 rounded-full bg-white/40 flex-shrink-0" />
            Build: {activeBuild.label}
          </button>
          <div className="w-px self-stretch bg-white/30" />
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="min-h-10 px-2 py-1.5 hover:opacity-80 transition-opacity"
            aria-label="Clear build filter"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        /* Idle state */
        <button
          onClick={() => setOpen((v) => !v)}
          className="min-h-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors bg-white"
        >
          <span className="sm:hidden">Build…</span>
          <span className="hidden sm:inline">Where Can I Build A…</span>
          <ChevronDown
            className="w-3.5 h-3.5 text-gray-400 transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full right-0 sm:left-0 sm:right-auto mt-2 z-50 bg-white rounded-xl border border-gray-100 shadow-xl overflow-hidden min-w-44 max-w-[calc(100vw-1rem)]">
          <div className="px-3 pt-2.5 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Use Type
          </div>
          {BUILD_TYPES.map((bt) => {
            const ready =
              bt.allowedCodes.length > 0 ||
              (bt.provisionalCodes?.length ?? 0) > 0 ||
              bt.notAllowedCodes.length > 0;
            const active = activeBuild?.id === bt.id;
            return (
              <button
                key={bt.id}
                disabled={!ready}
                onClick={() => { onChange(active ? null : bt); setOpen(false); }}
                className={`min-h-10 flex items-center justify-between w-full px-3 py-2 text-sm text-left transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : ready
                    ? "text-gray-700 hover:bg-gray-50"
                    : "text-gray-300 cursor-not-allowed"
                }`}
              >
                {bt.label}
                {!ready && (
                  <span className="text-xs text-gray-300 ml-3">soon</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
