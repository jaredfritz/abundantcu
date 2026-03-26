"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon, Position } from "geojson";
import {
  AlertTriangle, Check, ChevronDown, Download, Layers, LogIn, LogOut, Pencil, Plus, Satellite, Trash2, UserPlus, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DbParkingFeature } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type ParkingType = "surface" | "garage";
type Basemap = "roadmap" | "satellite";
type AuthTab = "signin" | "signup";

interface ParkingFeature {
  id: string;
  type: ParkingType;
  name?: string;
  coordinates: [number, number][][];
  created_by: string;       // auth UUID
  created_by_name: string;  // display name
}

interface OverlapInfo {
  existingId: string;
  overlapPct: number;
  clippedCoords: [number, number][][] | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ParkingType, { label: string; fill: string; border: string; text: string }> = {
  surface: { label: "Surface Lot", fill: "#ef4444", border: "#b91c1c", text: "text-red-600" },
  garage: { label: "Parking Garage", fill: "#f97316", border: "#c2410c", text: "text-orange-600" },
};

const DOWNTOWN_CENTER = { lat: 40.1165, lng: -88.2434 };
const INITIAL_ZOOM = 17;
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID";
const LEGACY_STORAGE_KEY = "parking-mapper-gmap-v1";
const MINOR_OVERLAP_THRESHOLD = 0.05;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRect(a: [number, number], b: [number, number]): [number, number][] {
  return [a, [b[0], a[1]], b, [a[0], b[1]]];
}

function snapToAxis(pos: [number, number], last: [number, number]): [number, number] {
  const dx = pos[0] - last[0];
  const dy = pos[1] - last[1];
  return Math.abs(dx) >= Math.abs(dy) ? [pos[0], last[1]] : [last[0], pos[1]];
}

function displayName(f: ParkingFeature, index: number): string {
  return f.name ?? `${TYPE_CONFIG[f.type].label} ${index + 1}`;
}

function toGPath(ring: [number, number][]): google.maps.LatLngLiteral[] {
  return ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
}

function dbToFeature(row: DbParkingFeature): ParkingFeature {
  return {
    id: row.id,
    type: row.type,
    name: row.name ?? undefined,
    coordinates: row.coordinates,
    created_by: row.created_by,
    created_by_name: row.created_by_name,
  };
}

function getUserDisplayName(user: User): string {
  return (user.user_metadata?.display_name as string | undefined) ?? user.email?.split("@")[0] ?? "contributor";
}

// ─── Overlap detection ────────────────────────────────────────────────────────

function detectOverlaps(newCoords: [number, number][], existing: ParkingFeature[]): OverlapInfo[] {
  const closed = [...newCoords, newCoords[0]];
  let newPoly: Feature<Polygon>;
  try { newPoly = turf.polygon([closed]); }
  catch { return []; }
  const newArea = turf.area(newPoly);
  const overlaps: OverlapInfo[] = [];

  for (const f of existing) {
    let existingPoly: Feature<Polygon>;
    try { existingPoly = turf.polygon(f.coordinates as Position[][]); }
    catch { continue; }

    let intersection: Feature<Polygon | MultiPolygon> | null = null;
    try { intersection = turf.intersect(turf.featureCollection([newPoly, existingPoly])); }
    catch { continue; }
    if (!intersection) continue;

    const overlapArea = turf.area(intersection);
    if (overlapArea < 0.01) continue;

    const existingArea = turf.area(existingPoly);
    const smallerArea = Math.min(newArea, existingArea);
    const overlapPct = overlapArea / smallerArea;

    let clippedCoords: [number, number][][] | null = null;
    try {
      const diff = turf.difference(turf.featureCollection([newPoly, existingPoly]));
      if (diff) {
        const geom = diff.geometry;
        if (geom.type === "Polygon") {
          clippedCoords = geom.coordinates as [number, number][][];
        } else if (geom.type === "MultiPolygon") {
          const sorted = [...geom.coordinates].sort(
            (a, b) => turf.area(turf.polygon(b as Position[][])) - turf.area(turf.polygon(a as Position[][]))
          );
          clippedCoords = sorted[0] as [number, number][][];
        }
      }
    } catch { /* clip failed; leave-as-is still available */ }

    overlaps.push({ existingId: f.id, overlapPct, clippedCoords });
  }
  return overlaps;
}

// ─── MapContent ───────────────────────────────────────────────────────────────

interface MapContentProps {
  features: ParkingFeature[];
  selectedId: string | null;
  drawing: boolean;
  drawMode: "polygon" | "rectangle";
  cfg: (typeof TYPE_CONFIG)[ParkingType];
  liveVerts: [number, number][];
  rectPreviewCoords: [number, number][] | null;
  vertices: [number, number][];
  selectedFeature: ParkingFeature | undefined;
  editableVertices: [number, number][];
  editMode: boolean;
  onFeatureClick: (id: string) => void;
  onVertexDrag: (id: string, idx: number, lat: number, lng: number) => void;
  onVertexDragEnd: (id: string, idx: number, lat: number, lng: number) => void;
  instanceRef: React.MutableRefObject<google.maps.Map | null>;
  onMapReady?: () => void;
}

function MapContent({
  features, selectedId, drawing, drawMode, cfg, liveVerts, rectPreviewCoords, vertices,
  selectedFeature, editableVertices, editMode, onFeatureClick, onVertexDrag, onVertexDragEnd, instanceRef, onMapReady,
}: MapContentProps) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const onFeatureClickRef = useRef(onFeatureClick);
  useEffect(() => { onFeatureClickRef.current = onFeatureClick; }, [onFeatureClick]);
  useEffect(() => {
    instanceRef.current = map;
    if (map) onMapReady?.();
  }, [map, instanceRef, onMapReady]);

  useEffect(() => {
    if (!map) return;
    map.setOptions({ draggableCursor: drawing ? "crosshair" : "" });
  }, [map, drawing]);

  const featureOverlaysRef = useRef<{ id: string; poly: google.maps.Polygon; highlight: google.maps.Polygon | null }[]>([]);

  useEffect(() => {
    if (!map || !mapsLib) return;
    const { Polygon } = mapsLib;
    featureOverlaysRef.current.forEach(({ poly, highlight }) => { poly.setMap(null); highlight?.setMap(null); });

    featureOverlaysRef.current = features.map((f) => {
      const paths = [toGPath(f.coordinates[0])];
      const isSelected = f.id === selectedId;
      const highlight = isSelected
        ? new Polygon({ map, paths, fillOpacity: 0, strokeColor: "#ffffff", strokeWeight: 6, strokeOpacity: 0.8, clickable: false, zIndex: 1 })
        : null;
      const poly = new Polygon({
        map, paths,
        fillColor: TYPE_CONFIG[f.type].fill, fillOpacity: 0.4,
        strokeColor: TYPE_CONFIG[f.type].border, strokeWeight: isSelected ? 2.5 : 2,
        clickable: !drawing, zIndex: 2,
      });
      poly.addListener("click", () => onFeatureClickRef.current(f.id));
      return { id: f.id, poly, highlight };
    });

    return () => {
      featureOverlaysRef.current.forEach(({ poly, highlight }) => { poly.setMap(null); highlight?.setMap(null); });
      featureOverlaysRef.current = [];
    };
  }, [map, mapsLib, features, selectedId, drawing]);

  const previewPolyRef = useRef<google.maps.Polygon | null>(null);
  const previewLineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    previewPolyRef.current?.setMap(null);
    previewLineRef.current?.setMap(null);
    previewPolyRef.current = null;
    previewLineRef.current = null;
    if (!map || !mapsLib || !drawing) return;
    const { Polygon, Polyline } = mapsLib;

    if (drawMode === "rectangle" && rectPreviewCoords) {
      previewPolyRef.current = new Polygon({
        map, paths: [rectPreviewCoords.map(([lng, lat]) => ({ lat, lng }))],
        fillColor: cfg.fill, fillOpacity: 0.2, strokeColor: cfg.border, strokeWeight: 2, clickable: false,
      });
    } else if (drawMode === "polygon") {
      const path = liveVerts.map(([lng, lat]) => ({ lat, lng }));
      if (path.length >= 3) {
        previewPolyRef.current = new Polygon({
          map, paths: [path], fillColor: cfg.fill, fillOpacity: 0.2, strokeColor: cfg.border, strokeWeight: 2, clickable: false,
        });
      } else if (path.length >= 2) {
        previewLineRef.current = new Polyline({ map, path, strokeColor: cfg.border, strokeWeight: 2, clickable: false });
      }
    }
    return () => { previewPolyRef.current?.setMap(null); previewLineRef.current?.setMap(null); };
  }, [map, mapsLib, drawing, drawMode, liveVerts, rectPreviewCoords, cfg]);

  const extractLatLng = (e: any): { lat: number; lng: number } | null => {
    const ll = e.latLng ?? e.detail?.latLng;
    if (!ll) return null;
    return { lat: typeof ll.lat === "function" ? ll.lat() : ll.lat, lng: typeof ll.lng === "function" ? ll.lng() : ll.lng };
  };

  return (
    <>
      {editMode && selectedFeature && editableVertices.map(([lng, lat], idx) => (
        <AdvancedMarker key={`${selectedId}-v${idx}`} position={{ lat, lng }} draggable
          onDrag={(e: any) => { const ll = extractLatLng(e); if (ll) onVertexDrag(selectedId!, idx, ll.lat, ll.lng); }}
          onDragEnd={(e: any) => { const ll = extractLatLng(e); if (ll) onVertexDragEnd(selectedId!, idx, ll.lat, ll.lng); }}
        >
          <div className="h-3.5 w-3.5 rounded-full border-2 border-white shadow-md cursor-grab active:cursor-grabbing"
            style={{ backgroundColor: TYPE_CONFIG[selectedFeature.type].fill }} />
        </AdvancedMarker>
      ))}
      {drawing && vertices.map((coord, idx) => (
        <AdvancedMarker key={`vdot-${idx}`} position={{ lat: coord[1], lng: coord[0] }}>
          <div className="rounded-full border-2 border-white shadow-md" style={{ width: 10, height: 10, backgroundColor: cfg.fill }} />
        </AdvancedMarker>
      ))}
      {drawing && drawMode === "polygon" && vertices.length >= 3 && (
        <AdvancedMarker position={{ lat: vertices[0][1], lng: vertices[0][0] }}>
          <div className="rounded-full border-2 border-white shadow-md cursor-pointer"
            style={{ width: 18, height: 18, backgroundColor: cfg.fill, boxShadow: `0 0 0 3px ${cfg.border}` }}
            title="Click to close polygon" />
        </AdvancedMarker>
      )}
    </>
  );
}

// ─── Auth modal ───────────────────────────────────────────────────────────────

function AuthModal({ onSuccess, onClose }: { onSuccess: (user: User) => void; onClose: () => void }) {
  const [tab, setTab] = useState<AuthTab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => { setError(null); setInfo(null); setEmail(""); setPassword(""); setDisplayName(""); };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setInfo(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (data.user) onSuccess(data.user);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { setError("Display name is required."); return; }
    if (displayName.trim().length < 2) { setError("Display name must be at least 2 characters."); return; }
    setLoading(true); setError(null); setInfo(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    try {
      await fetch("/api/editor-access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim(),
          notes: "Access request from Parking Mapper account signup.",
          requesterUserId: data.user?.id,
        }),
      });
    } catch {
      // Non-fatal; account creation should still succeed.
    }
    setInfo("Account created. Editor access request submitted for review.");
    if (data.user) onSuccess(data.user);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <button
              onClick={() => { setTab("signin"); reset(); }}
              className={`text-sm font-semibold pb-0.5 border-b-2 transition-colors ${tab === "signin" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setTab("signup"); reset(); }}
              className={`text-sm font-semibold pb-0.5 border-b-2 transition-colors ${tab === "signup" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            >
              Create account
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={tab === "signin" ? handleSignIn : handleSignUp} className="mt-5 space-y-3">
          {tab === "signup" && (
            <input
              autoFocus
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setError(null); }}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            autoFocus={tab === "signin"}
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
          />
          {tab === "signup" && (
            <p className="text-[11px] leading-relaxed text-gray-500">
              Creating an account also submits an editor access request for approval.
            </p>
          )}
          {info && <p className="text-xs text-emerald-700">{info}</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
          >
            {tab === "signin" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {loading ? "…" : tab === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Overlap modal ────────────────────────────────────────────────────────────

function OverlapModal({ overlaps, features, onClip, onLeave, onCancel }: {
  overlaps: OverlapInfo[];
  features: ParkingFeature[];
  onClip: () => void;
  onLeave: () => void;
  onCancel: () => void;
}) {
  const maxPct = Math.max(...overlaps.map((o) => o.overlapPct));
  const isMinor = maxPct < MINOR_OVERLAP_THRESHOLD;
  const canClip = overlaps.some((o) => o.clippedCoords !== null);
  const names = overlaps.map((o) => {
    const f = features.find((f) => f.id === o.existingId);
    return f ? (f.name ?? TYPE_CONFIG[f.type].label) : "another polygon";
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isMinor ? "Minor overlap detected" : "Overlap detected"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Overlaps with{" "}
              {names.length === 1
                ? <strong>{names[0]}</strong>
                : <><strong>{names.slice(0, -1).join(", ")}</strong> and <strong>{names.at(-1)}</strong></>
              }{" "}
              ({(maxPct * 100).toFixed(1)}% of the smaller polygon).
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-2">
          {canClip && (
            <button onClick={onClip}
              className="flex w-full flex-col rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100"
            >
              <span className="text-sm font-semibold text-amber-900">
                {isMinor ? "Snap edge to existing boundary" : "Clip around existing polygon"}
              </span>
              <span className="mt-0.5 text-xs text-amber-700">
                {isMinor ? "Trims the overlap so edges align perfectly." : "Cuts the new polygon to remove the overlapping area."}
              </span>
            </button>
          )}
          <button onClick={onLeave}
            className="flex w-full flex-col rounded-xl border border-gray-200 px-4 py-3 text-left transition hover:bg-gray-50"
          >
            <span className="text-sm font-semibold text-gray-800">Leave as-is</span>
            <span className="mt-0.5 text-xs text-gray-500">Save the polygon with the overlap intact.</span>
          </button>
          <button onClick={onCancel}
            className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Cancel (keep drawing)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ParkingMapperProps {
  editMode?: boolean;
  captureMode?: boolean;
  initialBasemap?: Basemap;
  initialTilt?: boolean;
}

export default function ParkingMapper({
  editMode = false,
  captureMode = false,
  initialBasemap = "satellite",
  initialTilt = false,
}: ParkingMapperProps) {
  const [basemap, setBasemap] = useState<Basemap>(initialBasemap);
  const [tiltOn, setTiltOn] = useState(initialTilt);
  const [drawing, setDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState<"polygon" | "rectangle">("polygon");
  const [drawType, setDrawType] = useState<ParkingType>("surface");
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const [mousePos, setMousePos] = useState<[number, number] | null>(null);
  const [features, setFeatures] = useState<ParkingFeature[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const listContainerRef = useRef<HTMLUListElement | null>(null);
  const listItemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingDraw, setPendingDraw] = useState(false);
  const [editorAllowed, setEditorAllowed] = useState(!editMode);
  const [editorStatusLoading, setEditorStatusLoading] = useState(editMode);
  const [editorStatusError, setEditorStatusError] = useState("");
  const [accessRequestState, setAccessRequestState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [accessRequestMessage, setAccessRequestMessage] = useState("");

  // Overlap resolution
  const [pendingFeature, setPendingFeature] = useState<{ coords: [number, number][]; overlaps: OverlapInfo[] } | null>(null);

  const drawingRef = useRef(drawing);
  const drawModeRef = useRef(drawMode);
  const verticesRef = useRef(vertices);
  const drawTypeRef = useRef(drawType);
  const featuresRef = useRef(features);
  const userRef = useRef(user);
  const gmapRef = useRef<google.maps.Map | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dblClickFiredRef = useRef(false);
  const migratedRef = useRef(false);

  useEffect(() => { drawingRef.current = drawing; }, [drawing]);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { verticesRef.current = vertices; }, [vertices]);
  useEffect(() => { drawTypeRef.current = drawType; }, [drawType]);
  useEffect(() => { featuresRef.current = features; }, [features]);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    if (!editMode) {
      setEditorAllowed(true);
      setEditorStatusLoading(false);
      setEditorStatusError("");
      return;
    }
    if (!user) {
      setEditorAllowed(false);
      setEditorStatusLoading(false);
      setEditorStatusError("");
      return;
    }

    let cancelled = false;
    const checkEditorAccess = async () => {
      setEditorStatusLoading(true);
      setEditorStatusError("");
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (!cancelled) {
            setEditorAllowed(false);
            setEditorStatusError("Session token missing. Please sign out and sign in again.");
          }
          return;
        }
        const response = await fetch("/api/editor-access/status", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as { allowed?: boolean; error?: string } | null;
        if (cancelled) return;
        if (!response.ok) {
          setEditorAllowed(false);
          setEditorStatusError(payload?.error ?? "Unable to verify editor access right now.");
          return;
        }
        setEditorAllowed(Boolean(payload?.allowed));
      } catch {
        if (!cancelled) {
          setEditorAllowed(false);
          setEditorStatusError("Unable to verify editor access right now.");
        }
      } finally {
        if (!cancelled) setEditorStatusLoading(false);
      }
    };

    void checkEditorAccess();
    return () => { cancelled = true; };
  }, [editMode, user]);

  // Migrate localStorage data once after user signs in (defined before auth effect)
  const migrateLocalStorage = useCallback(async (u: User) => {
    if (migratedRef.current) return;
    migratedRef.current = true;
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return;
      const legacy: { id: string; type: ParkingType; name?: string; coordinates: [number, number][][] }[] = JSON.parse(raw);
      if (!Array.isArray(legacy) || legacy.length === 0) return;

      const name = getUserDisplayName(u);
      const { error } = await supabase.from("parking_features").upsert(
        legacy.map((f) => ({
          id: f.id,
          type: f.type,
          name: f.name ?? null,
          coordinates: f.coordinates,
          created_by: u.id,
          created_by_name: name,
        })),
        { onConflict: "id" }
      );
      if (!error) {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        const { data } = await supabase.from("parking_features").select("*").order("created_at");
        setFeatures((data ?? []).map(dbToFeature));
      }
    } catch { /* non-fatal */ }
  }, []);

  // Auth session listener — also triggers localStorage migration on restore
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) migrateLocalStorage(u);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) migrateLocalStorage(u);
    });
    return () => subscription.unsubscribe();
  }, [migrateLocalStorage]);

  // Load features from Supabase
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.from("parking_features").select("*").order("created_at");
      setFeatures((data ?? []).map(dbToFeature));
      setLoading(false);
    }
    load();
  }, []);

  const handleAuthSuccess = useCallback(async (u: User) => {
    setUser(u);
    setShowAuthModal(false);
    await migrateLocalStorage(u);
  }, [migrateLocalStorage]);

  // Supabase write helpers
  const saveFeature = useCallback(async (feature: ParkingFeature) => {
    await supabase.from("parking_features").upsert(
      { id: feature.id, type: feature.type, name: feature.name ?? null, coordinates: feature.coordinates, created_by: feature.created_by, created_by_name: feature.created_by_name },
      { onConflict: "id" }
    );
  }, []);

  const removeFeature = useCallback(async (id: string) => {
    await supabase.from("parking_features").delete().eq("id", id);
  }, []);

  // Drawing flow
  const startDrawing = () => {
    if (!user) {
      setPendingDraw(true);
      setShowAuthModal(true);
      return;
    }
    if (!editorAllowed) return;
    setDrawing(true);
    setSelectedId(null);
  };

  const requestEditorAccess = useCallback(async () => {
    if (!user?.email) return;
    setAccessRequestState("submitting");
    setAccessRequestMessage("");
    try {
      const response = await fetch("/api/editor-access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          displayName: getUserDisplayName(user),
          notes: "Access request from Parking Mapper.",
          requesterUserId: user.id,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to submit request.");
      }
      setAccessRequestState("success");
      setAccessRequestMessage("Request submitted. You will be notified once access is approved.");
    } catch (error) {
      setAccessRequestState("error");
      setAccessRequestMessage(error instanceof Error ? error.message : "Unable to submit request.");
    }
  }, [user]);

  useEffect(() => {
    if (!pendingDraw || editorStatusLoading) return;
    if (editorAllowed) {
      setDrawing(true);
      setSelectedId(null);
    }
    setPendingDraw(false);
  }, [editorAllowed, editorStatusLoading, pendingDraw]);

  useEffect(() => {
    if (!captureMode) return;
    (window as { __PARKING_EXPORT_READY?: boolean }).__PARKING_EXPORT_READY = false;
    document.body.dataset.parkingExportReady = "false";
  }, [captureMode]);

  useEffect(() => {
    if (!captureMode) return;
    const ready = mapReady && !loading;
    (window as { __PARKING_EXPORT_READY?: boolean }).__PARKING_EXPORT_READY = ready;
    document.body.dataset.parkingExportReady = ready ? "true" : "false";
  }, [captureMode, loading, mapReady]);

  const commitFeature = useCallback(async (coords: [number, number][], u: User) => {
    const feature: ParkingFeature = {
      id: crypto.randomUUID(),
      type: drawTypeRef.current,
      coordinates: [[...coords, coords[0]]],
      created_by: u.id,
      created_by_name: getUserDisplayName(u),
    };
    setFeatures((prev) => [...prev, feature]);
    await saveFeature(feature);
    setVertices([]);
    setMousePos(null);
    setDrawing(false);
    dblClickFiredRef.current = false;
  }, [saveFeature]);

  const completePolygon = useCallback((verts: [number, number][]) => {
    if (verts.length < 3) return;
    const u = userRef.current;
    if (!u) return;
    const overlaps = detectOverlaps(verts, featuresRef.current);
    if (overlaps.length > 0) {
      setPendingFeature({ coords: verts, overlaps });
      return;
    }
    commitFeature(verts, u);
  }, [commitFeature]);

  const handleOverlapClip = async () => {
    if (!pendingFeature || !userRef.current) return;
    const { coords, overlaps } = pendingFeature;
    let current: Feature<Polygon | MultiPolygon> | null;
    try { current = turf.polygon([[...coords, coords[0]]]); }
    catch { setPendingFeature(null); return; }

    for (const o of overlaps) {
      if (!current) break;
      const existing = featuresRef.current.find((f) => f.id === o.existingId);
      if (!existing) continue;
      try {
        const diff = turf.difference(turf.featureCollection([current, turf.polygon(existing.coordinates as Position[][])]));
        if (diff) current = diff;
      } catch { /* keep current */ }
    }

    if (!current) { setPendingFeature(null); return; }
    const geom = current.geometry;
    let finalCoords: [number, number][];
    if (geom.type === "Polygon") {
      finalCoords = (geom.coordinates[0] as [number, number][]).slice(0, -1);
    } else {
      const sorted = [...geom.coordinates].sort(
        (a, b) => turf.area(turf.polygon(b as Position[][])) - turf.area(turf.polygon(a as Position[][]))
      );
      finalCoords = (sorted[0][0] as [number, number][]).slice(0, -1);
    }
    setPendingFeature(null);
    await commitFeature(finalCoords, userRef.current);
  };

  const handleOverlapLeave = async () => {
    if (!pendingFeature || !userRef.current) return;
    const coords = pendingFeature.coords;
    setPendingFeature(null);
    await commitFeature(coords, userRef.current);
  };

  const cancelDrawing = () => {
    setDrawing(false);
    setVertices([]);
    setMousePos(null);
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
  };

  // Map event handlers
  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (!drawingRef.current) { setSelectedId(null); return; }
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    const latLng = e.detail.latLng;
    if (!latLng) return;
    const shiftHeld = (e.domEvent as MouseEvent).shiftKey ?? false;
    const raw: [number, number] = [latLng.lng, latLng.lat];

    clickTimerRef.current = setTimeout(() => {
      if (dblClickFiredRef.current) { dblClickFiredRef.current = false; return; }
      const verts = verticesRef.current;
      if (drawModeRef.current === "rectangle") {
        if (verts.length === 0) { setVertices([raw]); }
        else { completePolygon(makeRect(verts[0], raw)); }
        return;
      }
      if (verts.length >= 3) {
        const map = gmapRef.current;
        if (map) {
          const proj = map.getProjection();
          const zoom = map.getZoom() ?? 17;
          const scale = Math.pow(2, zoom);
          if (proj) {
            const p1 = proj.fromLatLngToPoint({ lat: verts[0][1], lng: verts[0][0] });
            const p2 = proj.fromLatLngToPoint({ lat: raw[1], lng: raw[0] });
            if (p1 && p2 && Math.hypot((p1.x - p2.x) * scale, (p1.y - p2.y) * scale) < 14) {
              completePolygon(verts); return;
            }
          }
        }
      }
      const snapped = shiftHeld && verts.length > 0 ? snapToAxis(raw, verts[verts.length - 1]) : raw;
      setVertices((prev) => [...prev, snapped]);
    }, 200);
  }, [completePolygon]);

  const handleMapDblClick = useCallback((e: MapMouseEvent) => {
    if (!drawingRef.current || drawModeRef.current === "rectangle") return;
    e.stop();
    dblClickFiredRef.current = true;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    completePolygon(verticesRef.current);
  }, [completePolygon]);

  const handleMouseMove = useCallback((e: MapMouseEvent) => {
    if (!drawingRef.current) return;
    const latLng = e.detail.latLng;
    if (!latLng) return;
    const shiftHeld = (e.domEvent as MouseEvent).shiftKey ?? false;
    const raw: [number, number] = [latLng.lng, latLng.lat];
    const verts = verticesRef.current;
    setMousePos(shiftHeld && verts.length > 0 ? snapToAxis(raw, verts[verts.length - 1]) : raw);
  }, []);

  // Node editing
  const handleVertexDrag = useCallback((id: string, idx: number, lat: number, lng: number) => {
    setFeatures((prev) => prev.map((f) => {
      if (f.id !== id) return f;
      const ring = [...f.coordinates[0]];
      ring[idx] = [lng, lat];
      if (idx === 0) ring[ring.length - 1] = [lng, lat];
      return { ...f, coordinates: [ring] };
    }));
  }, []);

  const handleVertexDragEnd = useCallback((id: string, idx: number, lat: number, lng: number) => {
    setFeatures((prev) => {
      const updated = prev.map((f) => {
        if (f.id !== id) return f;
        const ring = [...f.coordinates[0]];
        ring[idx] = [lng, lat];
        if (idx === 0) ring[ring.length - 1] = [lng, lat];
        return { ...f, coordinates: [ring] };
      });
      const changed = updated.find((f) => f.id === id);
      if (changed) saveFeature(changed);
      return updated;
    });
  }, [saveFeature]);

  const handleFeatureClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  // Rename
  const startRename = (f: ParkingFeature, index: number) => {
    setEditingId(f.id);
    setEditingName(displayName(f, index));
  };

  const commitRename = () => {
    if (!editingId) return;
    const name = editingName.trim() || undefined;
    setFeatures((prev) => {
      const updated = prev.map((f) => (f.id === editingId ? { ...f, name } : f));
      const changed = updated.find((f) => f.id === editingId);
      if (changed) saveFeature(changed);
      return updated;
    });
    setEditingId(null);
    setEditingName("");
  };

  const deleteFeature = async (id: string) => {
    setFeatures((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
    await removeFeature(id);
  };

  useEffect(() => {
    if (!listOpen || !selectedId) return;
    const listItem = listItemRefs.current[selectedId];
    if (listItem) {
      listItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [listOpen, selectedId]);

  useEffect(() => {
    const map = gmapRef.current;
    if (!map) return;

    const enforceTilt = () => {
      if (!tiltOn && (map.getTilt() ?? 0) !== 0) {
        map.setTilt(0);
      }
    };

    if (tiltOn) {
      map.setTilt(45);
    } else {
      map.setTilt(0);
    }

    const zoomListener = map.addListener("zoom_changed", enforceTilt);
    const tiltListener = map.addListener("tilt_changed", enforceTilt);
    return () => {
      zoomListener.remove();
      tiltListener.remove();
    };
  }, [mapReady, tiltOn]);

  const exportGeoJSON = () => {
    const collection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: features.map((f, i) => ({
        type: "Feature",
        id: f.id,
        properties: { type: f.type, label: displayName(f, i), created_by: f.created_by_name },
        geometry: { type: "Polygon", coordinates: f.coordinates },
      })),
    };
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "parking-downtown-champaign.geojson";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setDrawing(false);
    setVertices([]);
    setMousePos(null);
  };

  // Derived
  const cfg = TYPE_CONFIG[drawType];
  const selectedFeature = features.find((f) => f.id === selectedId);
  const canEditMap = editMode && editorAllowed;
  const canEditSelected = canEditMap && !!user && !!selectedFeature && selectedFeature.created_by === user.id;
  const editableVertices = canEditSelected ? selectedFeature!.coordinates[0].slice(0, -1) : [];
  const rectPreviewCoords = drawMode === "rectangle" && vertices.length === 1 && mousePos ? makeRect(vertices[0], mousePos) : null;
  const liveVerts = drawMode === "rectangle" ? (rectPreviewCoords ?? vertices) : (mousePos ? [...vertices, mousePos] : vertices);
  const surfaceCount = features.filter((f) => f.type === "surface").length;
  const garageCount = features.filter((f) => f.type === "garage").length;

  return (
    <div className="relative overflow-hidden" style={{ height: captureMode ? "100dvh" : "calc(100dvh - 69px)" }}>
      {showAuthModal && (
        <AuthModal onSuccess={handleAuthSuccess} onClose={() => { setShowAuthModal(false); setPendingDraw(false); }} />
      )}
      {pendingFeature && (
        <OverlapModal
          overlaps={pendingFeature.overlaps}
          features={features}
          onClip={handleOverlapClip}
          onLeave={handleOverlapLeave}
          onCancel={() => setPendingFeature(null)}
        />
      )}

      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={DOWNTOWN_CENTER}
          defaultZoom={INITIAL_ZOOM}
          mapTypeId={basemap}
          mapId={MAP_ID}
          mapTypeControl={false}
          cameraControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          rotateControl={false}
          zoomControl
          gestureHandling="greedy"
          disableDoubleClickZoom
          onClick={handleMapClick}
          onDblclick={handleMapDblClick}
          onMousemove={canEditMap ? handleMouseMove : undefined}
          style={{ width: "100%", height: "100%" }}
        >
          <MapContent
            features={features}
            selectedId={selectedId}
            drawing={drawing}
            drawMode={drawMode}
            cfg={cfg}
            liveVerts={liveVerts}
            rectPreviewCoords={rectPreviewCoords}
            vertices={vertices}
            selectedFeature={canEditSelected ? selectedFeature : undefined}
            editableVertices={editableVertices}
            editMode={canEditMap}
            onFeatureClick={handleFeatureClick}
            onVertexDrag={handleVertexDrag}
            onVertexDragEnd={handleVertexDragEnd}
            instanceRef={gmapRef}
            onMapReady={() => setMapReady(true)}
          />
        </Map>
      </APIProvider>

      {/* Draw panel — edit mode only */}
      {editMode && (
        <div className="absolute left-4 top-4 z-10 w-56">
          {!user && (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-bold text-gray-900">Parking Mapper</p>
                <p className="mt-1 text-xs text-gray-500">Sign in to request editor access.</p>
              </div>
              <div className="p-3">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
                >
                  <LogIn className="h-4 w-4" aria-hidden />
                  Sign In
                </button>
              </div>
            </div>
          )}
          {user && !editorStatusLoading && !editorAllowed && (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-bold text-gray-900">Editor Access Required</p>
                <p className="mt-1 text-xs text-gray-500">
                  {editorStatusError
                    ? "We could not verify editor access right now."
                    : "Your account is signed in but not approved for map editing yet."}
                </p>
              </div>
              <div className="space-y-2.5 p-3">
                <button
                  onClick={() => { void requestEditorAccess(); }}
                  disabled={accessRequestState === "submitting"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-60"
                >
                  {accessRequestState === "submitting" ? "Submitting..." : "Request Editor Access"}
                </button>
                {accessRequestMessage && (
                  <p className={`text-[11px] leading-relaxed ${
                    accessRequestState === "error" ? "text-red-600" : "text-gray-600"
                  }`}>
                    {accessRequestMessage}
                  </p>
                )}
                {editorStatusError && (
                  <p className="text-[11px] leading-relaxed text-red-600">{editorStatusError}</p>
                )}
              </div>
            </div>
          )}
          {user && editorStatusLoading && (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg p-3">
              <p className="text-xs text-gray-500">Checking editor access...</p>
            </div>
          )}
          {canEditMap && (!drawing ? (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    {user ? `Editing as ${getUserDisplayName(user)}` : "Contributor mode"}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-gray-900">Parking Mapper</p>
                </div>
                {user && (
                  <button onClick={handleSignOut} className="text-gray-300 hover:text-gray-600" title="Sign out">
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="p-3 space-y-2.5">
                <div className="flex rounded-lg bg-gray-100 p-0.5 gap-0.5">
                  {(["surface", "garage"] as ParkingType[]).map((t) => (
                    <button key={t} onClick={() => setDrawType(t)}
                      className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all ${
                        drawType === t ? "bg-white shadow-sm " + TYPE_CONFIG[t].text : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {TYPE_CONFIG[t].label}
                    </button>
                  ))}
                </div>
                <div className="flex rounded-lg bg-gray-100 p-0.5 gap-0.5">
                  {(["rectangle", "polygon"] as const).map((m) => (
                    <button key={m} onClick={() => setDrawMode(m)}
                      className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all ${
                        drawMode === m ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {m === "rectangle" ? "Rectangle" : "Polygon"}
                    </button>
                  ))}
                </div>
                <button onClick={startDrawing}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {drawMode === "rectangle" ? "Draw Rectangle" : "Draw Polygon"}
                </button>
                <p className="text-center text-[11px] text-gray-400">
                  {canEditSelected
                    ? "Drag nodes to edit vertices."
                    : selectedId
                    ? "Created by another contributor."
                    : features.length === 0
                    ? "Select a type and draw polygons over parking areas."
                    : "Click a polygon to select it."}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div>
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${cfg.text}`}>
                    {drawMode === "rectangle" ? "Rectangle" : "Polygon"}: {cfg.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {drawMode === "rectangle"
                      ? vertices.length === 0 ? "Click first corner" : "Click opposite corner"
                      : vertices.length === 0 ? "Click to start" : `${vertices.length} point${vertices.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <button onClick={cancelDrawing} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-3 space-y-2">
                {drawMode === "rectangle" ? (
                  <p className="text-[11px] leading-relaxed text-gray-500">Click two opposite corners to draw a rectangle.</p>
                ) : (
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    Click to place vertices.<br />
                    <span className="font-semibold text-gray-700">Shift</span> = snap horizontal/vertical.<br />
                    Click first node or double-click to close.
                  </p>
                )}
                {drawMode === "polygon" && vertices.length >= 3 && (
                  <button onClick={() => completePolygon(vertices)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white"
                    style={{ backgroundColor: cfg.fill }}
                  >
                    Complete Polygon
                  </button>
                )}
                <button onClick={cancelDrawing}
                  className="flex w-full items-center justify-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!captureMode && (
        <>
          {/* Basemap toggle */}
          <div className="absolute right-4 top-4 z-10">
            <div className="flex gap-0.5 rounded-xl border border-gray-200 bg-white p-0.5 shadow-lg">
              {([["roadmap", "Map"], ["satellite", "Satellite"]] as const).map(([b, label]) => (
                <button key={b} onClick={() => setBasemap(b)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    basemap === b ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {b === "roadmap" ? <Layers className="h-3.5 w-3.5" aria-hidden /> : <Satellite className="h-3.5 w-3.5" aria-hidden />}
                  {label}
                </button>
              ))}
              <button
                onClick={() => setTiltOn((current) => !current)}
                className={`flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  tiltOn ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
                }`}
                aria-pressed={tiltOn}
              >
                Tilt
              </button>
            </div>
          </div>

          {/* Feature legend */}
          {features.length > 0 && !loading && (
            <div className="absolute bottom-4 left-4 z-10 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                <div className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-900">{surfaceCount}</span> lot{surfaceCount !== 1 ? "s" : ""}{" "}
                  &middot;{" "}
                  <span className="font-semibold text-gray-900">{garageCount}</span> garage{garageCount !== 1 ? "s" : ""}
                </div>
                <div className="flex items-center gap-1.5">
                  {canEditMap && (
                    <button
                      onClick={exportGeoJSON}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-3 w-3" aria-hidden />
                      Export
                    </button>
                  )}
                  <button
                    onClick={() => setListOpen((open) => !open)}
                    className="rounded-lg border border-gray-200 p-1 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                    aria-label={listOpen ? "Collapse parking list" : "Expand parking list"}
                    aria-expanded={listOpen}
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${listOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>
              {listOpen && (
                <ul ref={listContainerRef} className="max-h-52 divide-y divide-gray-50 overflow-y-auto">
                  {features.map((f, i) => (
                    <li key={f.id}
                      ref={(node) => { listItemRefs.current[f.id] = node; }}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                        selectedId === f.id ? "bg-gray-100 ring-1 ring-inset ring-gray-300" : "hover:bg-gray-50/60"
                      }`}
                      onClick={() => setSelectedId(selectedId === f.id ? null : f.id)}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TYPE_CONFIG[f.type].fill }} />
                      {canEditMap && editingId === f.id ? (
                        <form className="flex flex-1 items-center gap-1 min-w-0"
                          onSubmit={(e) => { e.preventDefault(); commitRename(); }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input autoFocus value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={commitRename}
                            className="min-w-0 flex-1 rounded border border-gray-300 px-1.5 py-0.5 text-xs outline-none focus:border-gray-400"
                          />
                          <button type="submit" className="shrink-0 text-gray-400 hover:text-green-500">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <span className="min-w-0 flex-1 truncate text-xs text-gray-800">{displayName(f, i)}</span>
                          {canEditMap && user && f.created_by === user.id && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); startRename(f, i); }}
                                className="shrink-0 text-gray-300 hover:text-gray-600 transition-colors" aria-label="Rename">
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); deleteFeature(f.id); }}
                                className="shrink-0 text-gray-300 hover:text-red-500 transition-colors" aria-label="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-800" />
        </div>
      )}
    </div>
  );
}
