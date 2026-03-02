"use client";

import { useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { GeocodedAddress, geocodeAddress } from "@/lib/geo";

interface AddressSearchProps {
  onResult: (result: GeocodedAddress) => void;
  onClear: () => void;
}

export default function AddressSearch({ onResult, onClear }: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<string | null>(null);

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResolved(null);
    try {
      const result = await geocodeAddress(q);
      if (!result) {
        setError("Address not found");
      } else {
        setResolved(result.displayName);
        onResult(result);
      }
    } catch {
      setError("Search failed — check your connection");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setQuery("");
    setResolved(null);
    setError(null);
    onClear();
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white pl-3 pr-1 py-1 focus-within:border-gray-400 transition-colors">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (resolved) setResolved(null);
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search address…"
            className="text-sm bg-transparent outline-none w-28 sm:w-48 text-gray-800 placeholder:text-gray-400"
          />
          {(query || resolved) && (
            <button
              onClick={handleClear}
              className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status line below input */}
        {error && (
          <div className="absolute top-full left-3 mt-1 text-xs text-red-500 whitespace-nowrap">
            {error}
          </div>
        )}
        {resolved && !error && (
          <div
            className="absolute top-full left-3 mt-1 text-xs text-gray-400 whitespace-nowrap max-w-xs truncate"
            title={resolved}
          >
            {resolved}
          </div>
        )}
      </div>

      <button
        onClick={handleSearch}
        disabled={loading || !query.trim()}
        className="p-1.5 rounded-full bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Search className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
