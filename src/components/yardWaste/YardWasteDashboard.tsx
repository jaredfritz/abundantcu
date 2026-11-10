"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck, MapPin } from "lucide-react";
import AddressSearch from "@/components/AddressSearch";
import { cardClass } from "@/components/crashes/shared";
import { AboutThisData } from "@/components/site/AboutThisData";
import { DataUpdated } from "@/components/site/DataUpdated";
import type { GeocodedAddress } from "@/lib/geo";
import {
  colorLabel,
  daysBetween,
  findYardWasteZone,
  formatPickup,
  formatPickupLong,
  formatShortDate,
  relativeDays,
  seasonOver as isSeasonOver,
  todayInChampaign,
  upcomingPickups,
  YARD_WASTE,
  zoneFill,
  zoneTextColor,
  type ZoneMatch,
} from "@/lib/yardWaste";
import { trackYardWaste } from "@/lib/yardWasteTrack";
import { AddToCalendar } from "./AddToCalendar";
import { InfoTip } from "./InfoTip";
import { YardWasteMap } from "./YardWasteMap";
import { YardWasteReminderForm } from "./YardWasteReminderForm";

const { meta } = YARD_WASTE;

interface SearchResult {
  address: GeocodedAddress;
  match: ZoneMatch | null;
}

export default function YardWasteDashboard({ remindersEnabled }: { remindersEnabled: boolean }) {
  // "Today" is only known in the browser; the server renders the schedule without past/next marks.
  const [today, setToday] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);

  useEffect(() => setToday(todayInChampaign()), []);

  const handleResult = (address: GeocodedAddress) => {
    const match = findYardWasteZone(address.lng, address.lat);
    setResult({ address, match });
    trackYardWaste(match ? "search_in_zone" : "search_outside", { zone: match?.zone.id });
  };

  const seasonOver = today !== null && isSeasonOver(today);
  const seasonNotStarted = today !== null && today < meta.start;

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold md:text-4xl">Yard Waste Collection</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700 md:text-base">
          The City of Champaign picks up bagged leaves and yard waste for free from every residential property inside
          city limits, each spring and fall.{" "}
          {seasonOver
            ? "Find your zone and see the dates from the season just ended."
            : `Find your zone and next pickup date, and add this season's dates to your calendar${
                remindersEnabled ? " or get an email before each pickup" : ""
              }.`}
        </p>
        <DataUpdated dataset="yardWaste" className="mt-2" />
      </div>

      {(seasonOver || seasonNotStarted) && (
        <div className="mb-6 rounded-[4px] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {seasonOver ? (
            <p className="flex gap-2">
              <CalendarCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>All {meta.label} collection dates have passed</strong> (the last was {formatShortDate(meta.end)}).
                The zones and dates below are kept for reference. The city posts the next season&apos;s dates on its{" "}
                <a href={meta.cityPageUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  yard waste page
                </a>
                , and this page will update once they&apos;re published.
              </span>
            </p>
          ) : (
            <>
              The {meta.label} collection runs {formatShortDate(meta.start)} to {formatShortDate(meta.end)}.
            </>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <div className={`${cardClass} p-4 md:p-5`}>
            <h2 className="text-lg font-semibold">Find your pickup dates</h2>
            <p className="mt-1 mb-3 text-sm text-slate-600">Search your address, or click the map.</p>
            <AddressSearch onResult={handleResult} onClear={() => setResult(null)} showResolved={false} />
          </div>

          {result && <ResultCard result={result} today={today} remindersEnabled={remindersEnabled} />}

          {!result && <SeasonCard today={today} />}
        </div>

        <div className={`${cardClass} min-w-0 p-2 md:p-3`}>
          <YardWasteMap
            point={result ? { lng: result.address.lng, lat: result.address.lat } : null}
            highlightZoneId={result?.match?.zone.id ?? null}
            today={today}
          />
        </div>
      </div>

      <div className={`${cardClass} mt-8 p-4 md:p-6`}>
        <h2 className="text-xl font-semibold">{meta.label} Schedule</h2>
        <p className="mt-1 text-sm text-slate-600">
          Each zone has {Math.max(...YARD_WASTE.zones.map((zone) => zone.pickups.length))} pickups this{" "}
          {meta.season}, from {formatShortDate(meta.start)} to {formatShortDate(meta.end)}.
        </p>
        <ScheduleTable today={today} highlightZoneId={result?.match?.zone.id ?? null} />
      </div>

      <div className={`${cardClass} mt-8 p-4 md:p-6`}>
        <h2 className="text-xl font-semibold">How to Set Out Yard Waste</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li>
            Put materials within 10 feet of the curb of a public street by <strong>6 a.m.</strong> on your collection day,
            and leave them until they&apos;re picked up.
          </li>
          <li>
            Use <strong>30-gallon paper yard waste bags</strong>. Yard waste in plastic bags or other containers isn&apos;t
            collected.
          </li>
          <li>Keep bags at least 5 feet from trees, mailboxes, light poles, fire hydrants, and other obstacles.</li>
          <li>
            Bundle twigs and branches with non-metallic twine, or bag them. Branches can be up to 2 inches thick and 3½ feet
            long; bundles up to 18 inches across.
          </li>
          <li>Burning leaves is prohibited in the City of Champaign.</li>
        </ul>
        <p className="mt-3 text-sm text-slate-700">
          Missed pickup? If your materials aren&apos;t collected by Friday of your collection week, look for a sticker
          explaining why. If they were out on time with no sticker, call Champaign Public Works at{" "}
          <a href="tel:2174034700" className="underline">
            217-403-4700
          </a>
          . Between seasons, the{" "}
          <a href="https://www.landscaperecyclingcenter.org/" target="_blank" rel="noopener noreferrer" className="underline">
            Landscape Recycling Center
          </a>{" "}
          in Urbana takes yard waste for a small fee.
        </p>
      </div>

      <AboutThisData credit={<>Zones and dates: City of Champaign Public Works.</>}>
        <p>
          Collection zones and dates come from the City of Champaign Public Works{" "}
          <a href={meta.cityMapUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Yard Waste Collection map
          </a>{" "}
          (
          <a href={meta.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
            map service
          </a>
          ) and{" "}
          <a href={meta.cityPageUrl} target="_blank" rel="noopener noreferrer" className="underline">
            yard waste page
          </a>
          . We check them for updates and redraw this map when the city posts a new season. If anything here differs from
          the city&apos;s information, the city&apos;s is right.
        </p>
        <p>
          <strong>Page counts:</strong> we count anonymous actions on this page (searches, calendar adds, reminder
          sign-ups) with only the zone and the time, to see what&apos;s useful. No addresses, emails, or cookies are
          involved.
        </p>
        <p>
          <strong>Finding your zone:</strong> your address is placed on the map by Google or OpenStreetMap, then matched to
          the zone it falls in. Zone lines follow streets and lot lines, so an address placed near a line can land in
          the zone next door; we flag addresses within 30 meters of another zone. Check the map, or call Public Works if
          you&apos;re unsure.
        </p>
        {remindersEnabled && (
        <p>
          <strong>Email reminders</strong> are for the {meta.label} collection only. They go out in the morning, the
          number of days before each pickup that you choose, and stop after the season&apos;s last pickup. We store
          your email, the address you searched and its map location, and your reminder timing to send them. If you
          check &ldquo;Email me when reminders open for future seasons,&rdquo; we keep them to let you know when you can
          sign up again; otherwise we use them only for this season. We don&apos;t share them or add you to any other
          list, and every email has an unsubscribe link. Reminders aren&apos;t sent by the city; the city has its own{" "}
          <a href={meta.cityEmailListUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Public Works notification emails
          </a>
          .
        </p>
        )}
      </AboutThisData>
    </section>
  );
}

function SeasonCard({ today }: { today: string | null }) {
  const nextAnywhere = useMemo(() => {
    if (!today) return null;
    const upcoming = YARD_WASTE.zones
      .flatMap((zone) => upcomingPickups(zone, today).map((pickup) => ({ zone, pickup })))
      .sort((a, b) => a.pickup.start.localeCompare(b.pickup.start));
    return upcoming[0] ?? null;
  }, [today]);
  return (
    <div className={`${cardClass} p-4 text-sm text-slate-700 md:p-5`}>
      <p className="font-semibold text-slate-900">{meta.label} collection</p>
      <p className="mt-1">
        {formatShortDate(meta.start)} to {formatShortDate(meta.end)}. Each zone is picked up on its own day; search your
        address or click the map to find yours.
      </p>
      {nextAnywhere && today && (
        <p className="mt-2">
          Next up: zone <strong>{nextAnywhere.zone.id}</strong>,{" "}
          {nextAnywhere.pickup.start === today ? "today" : formatPickup(nextAnywhere.pickup)}.
        </p>
      )}
    </div>
  );
}

function ResultCard({
  result,
  today,
  remindersEnabled,
}: {
  result: SearchResult;
  today: string | null;
  remindersEnabled: boolean;
}) {
  const { address, match } = result;
  if (!match) {
    return (
      <div className={`${cardClass} p-4 text-sm text-slate-700 md:p-5`}>
        <p className="flex items-center gap-2 font-semibold text-slate-900">
          <MapPin aria-hidden className="h-4 w-4" />
          Not in a Champaign collection zone
        </p>
        <p className="mt-1">
          The city collects yard waste only from residential properties inside Champaign city limits. If you live in
          Urbana, Savoy, or another town, check with your city. If you think this is wrong, try your full address with
          the ZIP code.
        </p>
      </div>
    );
  }

  return <ZoneResult match={match} address={address} today={today} remindersEnabled={remindersEnabled} />;
}

function ZoneResult({
  match,
  address,
  today,
  remindersEnabled,
}: {
  match: ZoneMatch;
  address: GeocodedAddress;
  today: string | null;
  remindersEnabled: boolean;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const { zone, nearBoundary } = match;
  const upcoming = today ? upcomingPickups(zone, today) : [];
  const next = upcoming[0];
  const days = next && today ? daysBetween(today, next.start) : null;

  return (
    <div className={cardClass}>
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] p-4 md:px-5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] text-sm font-bold"
          style={{ backgroundColor: zoneFill(zone.id), color: zoneTextColor(zone.id) }}
        >
          {zone.id}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">
            Zone {zone.id} · {colorLabel(zone.color)}
          </p>
          <p className="truncate text-sm text-slate-500" title={address.displayName}>
            {address.displayName}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-4 text-sm md:p-5">
        {today && next && days !== null && (
          <div>
            <p className="text-lg font-semibold text-[var(--color-primary)]">Next pickup: {formatPickupLong(next)}</p>
            <p className="text-slate-600">
              {days <= 0 ? "Today. Bags needed to be out by 6 a.m." : `${relativeDays(days)[0].toUpperCase()}${relativeDays(days).slice(1)}. Bags at the curb by 6 a.m.`}
            </p>
          </div>
        )}
        {today && !next && (
          <p className="text-slate-700">
            All {meta.label} pickups for zone {zone.id} have passed. The city will post next season&apos;s dates on its{" "}
            <a href={meta.cityPageUrl} target="_blank" rel="noopener noreferrer" className="underline">
              yard waste page
            </a>
            .
          </p>
        )}

        <div>
          <p className="flex items-center gap-1 font-semibold">
            {meta.label} pickups
            {upcoming.length > 0 && (
              <InfoTip label="About adding pickups to your calendar">
                &ldquo;Add to calendar&rdquo; adds a &ldquo;Put yard waste at the curb&rdquo; reminder at 5 p.m. the
                evening before. It&apos;s added once and won&apos;t change if the city updates its schedule.
              </InfoTip>
            )}
          </p>
          <ul className="mt-1 divide-y divide-slate-100">
            {zone.pickups.map((pickup) => {
              const past = today !== null && pickup.end < today;
              const remaining = today !== null && !past;
              return (
                <li key={pickup.start} className="flex min-h-11 items-center justify-between gap-3 py-1.5">
                  <span className={past ? "text-slate-400 line-through" : pickup === next ? "font-semibold" : ""}>
                    {formatPickup(pickup)}
                  </span>
                  {past && <span className="text-slate-400">Passed</span>}
                  {remaining && (
                    <AddToCalendar
                      zone={zone}
                      pickup={pickup}
                      address={address.displayName}
                      open={menuFor === pickup.start}
                      onOpenChange={(open) => setMenuFor(open ? pickup.start : null)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {nearBoundary && (
          <p className="flex gap-2 rounded-[4px] bg-amber-50 p-3 text-amber-900">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            This address is close to the line with another zone. Check that the pin is on your home, or confirm with
            Public Works at 217-403-4700.
          </p>
        )}

        {/* Reminders are for this season's remaining pickups only. */}
        {upcoming.length > 0 && (
          <YardWasteReminderForm
            address={address.displayName}
            lat={address.lat}
            lng={address.lng}
            zone={zone}
            enabled={remindersEnabled}
          />
        )}
      </div>
    </div>
  );
}

function ScheduleTable({ today, highlightZoneId }: { today: string | null; highlightZoneId: string | null }) {
  const th = "px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500";
  const rounds = Math.max(...YARD_WASTE.zones.map((zone) => zone.pickups.length));
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className={th}>Zone</th>
            <th className={th}>Day</th>
            {Array.from({ length: rounds }, (_, index) => (
              <th key={index} className={th}>
                Pickup {index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {YARD_WASTE.zones.map((zone) => {
            const next = today ? upcomingPickups(zone, today)[0] : undefined;
            const highlighted = zone.id === highlightZoneId;
            return (
              <tr key={zone.id} className={highlighted ? "bg-sky-50" : ""}>
                <td className="px-2 py-2 text-sm">
                  <span className="flex items-center gap-2 whitespace-nowrap font-medium">
                    <span className="h-3 w-4 shrink-0 rounded-[2px]" style={{ backgroundColor: zoneFill(zone.id) }} />
                    {zone.id}
                    <span className="hidden font-normal text-slate-500 sm:inline">{colorLabel(zone.color)}</span>
                  </span>
                </td>
                <td className="px-2 py-2 text-sm text-slate-700">{zone.weekday ?? "—"}</td>
                {Array.from({ length: rounds }, (_, index) => {
                  const pickup = zone.pickups[index];
                  if (!pickup) return <td key={index} />;
                  const past = today !== null && pickup.end < today;
                  return (
                    <td
                      key={index}
                      className={`whitespace-nowrap px-2 py-2 text-sm tabular-nums ${
                        past ? "text-slate-400 line-through" : pickup === next ? "font-semibold text-[var(--color-primary)]" : ""
                      }`}
                    >
                      {formatPickup(pickup)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">
        Bold is each zone&apos;s next pickup; struck-through dates have passed.
      </p>
    </div>
  );
}
