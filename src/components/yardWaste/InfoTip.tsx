"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

/**
 * A small "i" button that reveals a note on hover or tap. Keeps fine print out of the way: closes on a tap elsewhere
 * or Escape.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  // Hover shows the note; a click or tap pins it open (so a mouse click right after hovering doesn't close it).
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const wrapper = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!pinned) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setPinned(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPinned(false);
        setHovered(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", escape);
    };
  }, [pinned]);

  return (
    <span
      ref={wrapper}
      className="relative inline-flex align-middle"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setPinned((value) => !value)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 focus-visible:text-slate-700"
      >
        <Info aria-hidden className="h-4 w-4" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-6 z-30 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-[4px] border border-[var(--color-border)] bg-white p-3 text-sm font-normal leading-snug text-slate-700 shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
