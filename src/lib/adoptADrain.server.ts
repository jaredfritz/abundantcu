import type { DrainAction, DrainRow, MyDrain } from "./adoptADrain";
import { ADOPT_PAGE_PATH, NICKNAME_MAX } from "./adoptADrain";

/**
 * Server-side access to the City of Champaign's Adopt-a-Drain backend: an ArcGIS feature layer of catch basins and a
 * geoprocessing tool ("AuthGP") that handles sign-up, emailed sign-in links, and token checks.
 *
 * This mirrors what the City's own Web AppBuilder app (Esri's "Adopt-a" widget) sends, field for field, so drains
 * adopted here look exactly like drains adopted there. One deliberate difference: every edit is checked here first.
 * The sign-in token must validate with the City, and only the person who adopted a drain can release, rename, or
 * mark it cleaned.
 */

const SERVICES = "https://gisweb.champaignil.gov/cb/rest/services/Adopta";
const LAYER_URL = `${SERVICES}/AdoptaDrain/FeatureServer/0`;
const AUTH_URL = `${SERVICES}/AuthGP/GPServer/AuthGP/execute`;
const TIMEOUT_MS = 20_000;

/** What the City's app passes as Asset_popup_configuration: the drain title used in its sign-in emails. */
const POPUP_TITLE = "Catch Basins: {Nickname}";

/** The parts of the City's widget configuration its app sends to AuthGP (Login.js `_getRequiredConfigForGPTool`). */
const WIDGET_CONFIGURATION = JSON.stringify({
  actions: {
    assign: {
      name: "Adopt",
      urlParameterLabel: "assign",
      fieldsToUpdate: [
        { field: "RelateGUID", action: "SetValue", value: "{GlobalID}" },
        { field: "Assetstatus", action: "SetValue", value: "Adopted" },
        { field: "Adopteddate", action: "SetDate" },
        { field: "Laststatusupdate", action: "SetDate" },
      ],
    },
    unAssign: {
      name: "Release",
      urlParameterLabel: "unassign",
      fieldsToUpdate: [
        { field: "RelateGUID", action: "Clear" },
        { field: "Assetstatus", action: "SetValue", value: "Available" },
        { field: "Adopteddate", action: "Clear" },
        { field: "Nickname", action: "Clear" },
        { field: "Laststatusupdate", action: "SetDate" },
      ],
    },
    additionalActions: [
      {
        name: "Mark as Cleaned",
        urlParameterLabel: "clean",
        fieldsToUpdate: [
          { field: "Lastcleaneddate", action: "SetDate" },
          { field: "Laststatusupdate", action: "SetDate" },
        ],
        displayInMyAssets: true,
      },
    ],
  },
  nickNameField: "Nickname",
  foreignKeyFieldForUserTable: "RelateGUID",
});

const GUID_RE = /^\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?$/i;
const TOKEN_RE = /^[\x21-\x7e]{8,256}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export class CityServiceError extends Error {}

/** A user ID (the City's GUID for the person) without braces, or null if it isn't one. */
export function normalizeUserId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = GUID_RE.exec(value.trim());
  return match ? match[1].toUpperCase() : null;
}

export function isPlausibleToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

export function isPlausibleEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value.trim());
}

/** Plain text for a name or nickname: no control characters, collapsed spaces, capped length. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

async function cityFetch(url: string, init?: RequestInit): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new CityServiceError(`City service returned ${res.status}`);
    return await res.text();
  } catch (err) {
    if (err instanceof CityServiceError) throw err;
    throw new CityServiceError("City service unreachable");
  } finally {
    clearTimeout(timer);
  }
}

async function cityJson<T>(url: string, init?: RequestInit): Promise<T> {
  const text = await cityFetch(url, init);
  let data: T & { error?: { message?: string } };
  try {
    data = JSON.parse(text);
  } catch {
    throw new CityServiceError("City service sent an unreadable response");
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new CityServiceError(data.error.message ?? "City service error");
  }
  return data;
}

// ---------------------------------------------------------------------------------------------------------------
// AuthGP

/**
 * AuthGP's result is a Python dict printed into the JSON response (`{'status': 'Success', ...}`), which isn't valid
 * JSON. This rewrites Python literals (single-quoted strings, True/False/None) as JSON so the whole body parses.
 */
export function pythonishToJson(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'" || ch === '"') {
      let value = "";
      i += 1;
      while (i < text.length && text[i] !== ch) {
        if (text[i] === "\\" && i + 1 < text.length) {
          const next = text[i + 1];
          if (next === "n") value += "\n";
          else if (next === "t") value += "\t";
          else if (next === "r") value += "\r";
          else if (next === "/") value += "/";
          else if (next === "b") value += "\b";
          else if (next === "f") value += "\f";
          else if (next === "u" && /^[0-9a-f]{4}$/i.test(text.slice(i + 2, i + 6))) {
            value += String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16));
            i += 4;
          } else if (next === "x" && /^[0-9a-f]{2}$/i.test(text.slice(i + 2, i + 4))) {
            value += String.fromCharCode(parseInt(text.slice(i + 2, i + 4), 16));
            i += 2;
          } else value += next;
          i += 2;
        } else {
          value += text[i];
          i += 1;
        }
      }
      i += 1;
      out += JSON.stringify(value);
      continue;
    }
    const word = /^(True|False|None)\b/.exec(text.slice(i, i + 5));
    if (word && !/[A-Za-z0-9_]/.test(text[i - 1] ?? "")) {
      out += word[1] === "True" ? "true" : word[1] === "False" ? "false" : "null";
      i += word[1].length;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

export interface AuthResult {
  status: string;
  description: unknown;
}

async function runAuth(params: Record<string, string>): Promise<AuthResult> {
  const body = new URLSearchParams({ ...params, f: "json" });
  const text = await cityFetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  let data: { results?: { value?: unknown }[]; error?: { message?: string } };
  try {
    data = JSON.parse(text);
  } catch {
    try {
      data = JSON.parse(pythonishToJson(text));
    } catch {
      throw new CityServiceError("City sign-in service sent an unreadable response");
    }
  }
  if (data.error) throw new CityServiceError(data.error.message ?? "City sign-in service error");
  let value = data.results?.[0]?.value;
  if (typeof value === "string") {
    try {
      value = JSON.parse(pythonishToJson(value));
    } catch {
      // Leave it as a string; it's checked below.
    }
  }
  if (!value || typeof value !== "object" || typeof (value as AuthResult).status !== "string") {
    throw new CityServiceError("City sign-in service sent no result");
  }
  return value as AuthResult;
}

function isSuccess(result: AuthResult): boolean {
  return result.status.toLowerCase() === "success";
}

function describes(result: AuthResult, text: string): boolean {
  return typeof result.description === "string" && result.description.toLowerCase() === text;
}

export function appUrlFor(origin: string): string {
  return `${origin.replace(/\/$/, "")}${ADOPT_PAGE_PATH}`;
}

export type LoginOutcome = "sent" | "new_user";

/** Ask the City to email a sign-in link to a registered user. Returns "new_user" if the email isn't registered. */
export async function requestLoginEmail(email: string, appUrl: string, adoptId?: number): Promise<LoginOutcome> {
  const params: Record<string, string> = {
    Input_user_email: email,
    Action: "login",
    App_URL: appUrl,
    Asset_popup_configuration: POPUP_TITLE,
    Widget_configuration: WIDGET_CONFIGURATION,
  };
  if (adoptId) params.Adopted_assetid = String(adoptId);
  const result = await runAuth(params);
  if (isSuccess(result)) return "sent";
  if (describes(result, "user does not exist")) return "new_user";
  throw new CityServiceError(typeof result.description === "string" ? result.description : "Sign-in failed");
}

export interface SignupFields {
  firstName: string;
  lastName: string;
  team?: string;
}

/** The City's user-table field for team names, if it has one (the City's app asks AuthGP the same way). */
async function teamFieldName(): Promise<string | null> {
  const teams = await listTeams();
  return teams.field;
}

let teamsCache: { at: number; field: string | null; names: string[] } | null = null;

/** Team names already in use, for the sign-up form's suggestions. Cached for an hour. */
export async function listTeams(): Promise<{ field: string | null; names: string[] }> {
  if (teamsCache && Date.now() - teamsCache.at < 3_600_000) return teamsCache;
  const result = await runAuth({ Action: "Teams" });
  let field: string | null = null;
  const names = new Set<string>();
  const description = result.description as
    | { teamfield?: { name?: string }; features?: { attributes?: Record<string, unknown> }[] }
    | undefined;
  if (isSuccess(result) && description && typeof description === "object") {
    field = typeof description.teamfield?.name === "string" ? description.teamfield.name : null;
    if (field) {
      for (const feature of description.features ?? []) {
        const name = feature.attributes?.[field];
        if (typeof name === "string" && name.trim()) names.add(name.trim());
      }
    }
  }
  teamsCache = { at: Date.now(), field, names: [...names].sort((a, b) => a.localeCompare(b)) };
  return teamsCache;
}

/** Register a new user with the City, which emails them a confirmation link. */
export async function signUp(email: string, fields: SignupFields, appUrl: string, adoptId?: number): Promise<void> {
  const attributes: Record<string, string> = { Firstname: fields.firstName, Lastname: fields.lastName };
  if (fields.team) {
    const field = await teamFieldName().catch(() => null);
    if (field) attributes[field] = fields.team;
  }
  const params: Record<string, string> = {
    Input_user_email: email,
    Signup_fields: JSON.stringify(attributes),
    App_URL: appUrl,
    Action: "signup",
  };
  if (adoptId) params.Adopted_assetid = String(adoptId);
  const result = await runAuth(params);
  if (!isSuccess(result)) {
    throw new CityServiceError(typeof result.description === "string" ? result.description : "Sign-up failed");
  }
}

export type ValidateOutcome = { ok: true; email: string | null } | { ok: false; expired: boolean };

/**
 * Check a user ID and token from a City sign-in link. An expired token makes the City email a fresh link
 * ("regenerated usertoken"), which is reported as `expired`.
 */
export async function validateUser(userId: string, token: string, appUrl: string): Promise<ValidateOutcome> {
  const result = await runAuth({
    Userid: userId,
    Usertoken: token,
    Action: "validate",
    App_URL: appUrl,
    Asset_popup_configuration: POPUP_TITLE,
    Widget_configuration: WIDGET_CONFIGURATION,
  });
  if (!isSuccess(result)) return { ok: false, expired: false };
  if (describes(result, "regenerated usertoken")) return { ok: false, expired: true };
  const description = result.description as { email?: unknown } | null;
  const email = description && typeof description === "object" && typeof description.email === "string"
    ? description.email
    : null;
  return { ok: true, email };
}

// ---------------------------------------------------------------------------------------------------------------
// Drain layer

interface EsriFeature {
  attributes: Record<string, unknown>;
  geometry?: { x: number; y: number };
}

interface EsriQueryResponse {
  features?: EsriFeature[];
  exceededTransferLimit?: boolean;
}

const PUBLIC_FIELDS = "OBJECTID,Assetstatus,RelateGUID,Nickname,PROPRIETARY_ID,Adopteddate,Lastcleaneddate";

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isAdopted(attributes: Record<string, unknown>): boolean {
  return Boolean(str(attributes.RelateGUID)) || attributes.Assetstatus === "Adopted";
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

async function queryLayer(params: Record<string, string>): Promise<EsriFeature[]> {
  const features: EsriFeature[] = [];
  const pageSize = 4000;
  for (let offset = 0; offset < 100_000; offset += pageSize) {
    const query = new URLSearchParams({
      outSR: "4326",
      returnGeometry: "true",
      orderByFields: "OBJECTID",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
      f: "json",
      ...params,
    });
    const page = await cityJson<EsriQueryResponse>(`${LAYER_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: query,
    });
    features.push(...(page.features ?? []));
    if (!page.exceededTransferLimit || !page.features?.length) break;
  }
  return features;
}

/** Every drain, without adopters' user IDs. */
export async function fetchAllDrains(): Promise<DrainRow[]> {
  const features = await queryLayer({ where: "1=1", outFields: PUBLIC_FIELDS });
  const rows: DrainRow[] = [];
  for (const { attributes, geometry } of features) {
    const id = num(attributes.OBJECTID);
    if (id === null || !geometry || !Number.isFinite(geometry.x) || !Number.isFinite(geometry.y)) continue;
    const adopted = isAdopted(attributes);
    rows.push([
      id,
      round(geometry.x),
      round(geometry.y),
      adopted ? 1 : 0,
      adopted ? str(attributes.Nickname) : null,
      str(attributes.PROPRIETARY_ID),
      adopted ? num(attributes.Adopteddate) : null,
      num(attributes.Lastcleaneddate),
    ]);
  }
  return rows;
}

function toMyDrain({ attributes, geometry }: EsriFeature): MyDrain {
  return {
    id: num(attributes.OBJECTID) ?? 0,
    nickname: str(attributes.Nickname),
    cityId: str(attributes.PROPRIETARY_ID),
    adoptedAt: num(attributes.Adopteddate),
    cleanedAt: num(attributes.Lastcleaneddate),
    lng: geometry ? round(geometry.x) : 0,
    lat: geometry ? round(geometry.y) : 0,
  };
}

/** Drains adopted by one user. `userId` must come from normalizeUserId. */
export async function fetchMyDrains(userId: string): Promise<MyDrain[]> {
  const features = await queryLayer({ where: `RelateGUID = '{${userId}}'`, outFields: PUBLIC_FIELDS });
  return features.map(toMyDrain);
}

async function fetchDrain(objectId: number): Promise<EsriFeature | null> {
  const features = await queryLayer({ where: `OBJECTID = ${objectId}`, outFields: PUBLIC_FIELDS });
  return features[0] ?? null;
}

function sameUser(relateGuid: unknown, userId: string): boolean {
  const normalized = normalizeUserId(relateGuid);
  return normalized !== null && normalized === userId;
}

export class DrainActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Apply one action to a drain for a validated user, with the same field changes the City's app makes. Adopting
 * needs an unadopted drain; releasing, renaming, and marking cleaned need a drain this user adopted.
 */
export async function applyDrainAction(
  userId: string,
  objectId: number,
  action: DrainAction,
  nicknameInput?: unknown
): Promise<MyDrain | null> {
  const feature = await fetchDrain(objectId);
  if (!feature) throw new DrainActionError("That drain wasn't found.", 404);
  const adopted = isAdopted(feature.attributes);
  const mine = sameUser(feature.attributes.RelateGUID, userId);
  const now = Date.now();
  const nickname = cleanText(nicknameInput, NICKNAME_MAX) || null;
  let updates: Record<string, unknown>;

  switch (action) {
    case "adopt":
      if (mine) throw new DrainActionError("You've already adopted this drain.", 409);
      if (adopted) throw new DrainActionError("Someone else has already adopted this drain.", 409);
      updates = {
        RelateGUID: `{${userId}}`,
        Assetstatus: "Adopted",
        Adopteddate: now,
        Laststatusupdate: now,
        ...(nickname ? { Nickname: nickname } : {}),
      };
      break;
    case "release":
      if (!mine) throw new DrainActionError("This drain isn't on your list.", 403);
      updates = { RelateGUID: null, Assetstatus: "Available", Adopteddate: null, Nickname: null, Laststatusupdate: now };
      break;
    case "clean":
      if (!mine) throw new DrainActionError("This drain isn't on your list.", 403);
      updates = { Lastcleaneddate: now, Laststatusupdate: now };
      break;
    case "rename":
      if (!mine) throw new DrainActionError("This drain isn't on your list.", 403);
      updates = { Nickname: nickname };
      break;
  }

  const body = new URLSearchParams({
    updates: JSON.stringify([{ attributes: { OBJECTID: objectId, ...updates } }]),
    rollbackOnFailure: "true",
    f: "json",
  });
  const result = await cityJson<{ updateResults?: { success?: boolean }[] }>(`${LAYER_URL}/applyEdits`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!result.updateResults?.[0]?.success) throw new CityServiceError("The City's map didn't accept the change.");

  if (action === "release") return null;
  return toMyDrain({ attributes: { ...feature.attributes, ...updates }, geometry: feature.geometry });
}
