import type { Parcel } from "@/lib/parcels";
import {
  countyParcelUrl,
  formatAcres,
  formatMoney,
  formatPin,
  propertyClassLabel,
  titleCaseAddress,
} from "@/lib/parcels";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

export function ParcelPopup({ parcel, taxYear }: { parcel: Parcel; taxYear: number | null }) {
  const title = parcel.address ? titleCaseAddress(parcel.address) : `Parcel ${formatPin(parcel.pin)}`;
  const taxNote = parcel.exempt
    ? "Exempt"
    : parcel.taxRate === null
      ? "Rate not yet published"
      : formatMoney(parcel.tax);

  return (
    <div className="min-w-[230px] text-xs">
      {/* Right padding keeps the title clear of the popup's close button. */}
      <p className="pr-8 text-sm font-bold text-[var(--color-primary)]">{title}</p>
      <p className="mt-0.5 text-slate-500">
        {parcel.city}
        {parcel.units > 1 ? ` · ${parcel.units} condo units` : ""}
      </p>
      <dl className="mt-2 border-t border-slate-200 pt-1.5">
        <Row label="Value per acre" value={formatMoney(parcel.valuePerAcre)} />
        <Row label="Tax per acre (est.)" value={formatMoney(parcel.taxPerAcre)} />
        <Row label="Market value (est.)" value={parcel.exempt ? "Exempt" : formatMoney(parcel.marketValue)} />
        <Row label={`${taxYear ?? ""} tax before exemptions`.trim()} value={taxNote} />
        <Row
          label="Land share of value"
          value={parcel.landShare === null ? "—" : `${Math.round(parcel.landShare * 100)}%`}
        />
        <Row label="Acres" value={formatAcres(parcel.acres)} />
        <Row label="Class" value={propertyClassLabel(parcel.useCode)} />
        {parcel.tif && <Row label="TIF district" value={parcel.tif.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bTif\b/, "TIF")} />}
      </dl>
      {parcel.landUse === "Farm" && (
        <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
          Farmland is assessed on what it can produce, not its market value.
        </p>
      )}
      <a
        href={countyParcelUrl(parcel.pin, taxYear)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block font-semibold text-[var(--color-accent-secondary)] underline"
      >
        County record for {formatPin(parcel.pin)} ↗
      </a>
    </div>
  );
}
