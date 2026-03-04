import HomeZoningPreview from "@/components/map/HomeZoningPreview";
import ZoningExplorer from "@/components/map/ZoningExplorer";
import type { ViewState } from "react-map-gl/maplibre";

export interface MapEmbedProps {
  mode: "home" | "full";
  interactive: boolean;
  initialViewState?: Partial<ViewState>;
  className?: string;
  data: GeoJSON.FeatureCollection;
  permitsData?: GeoJSON.FeatureCollection;
}

export default function MapEmbed({
  mode,
  interactive,
  initialViewState,
  className,
  data,
  permitsData,
}: MapEmbedProps) {
  if (mode === "full") {
    if (!permitsData) {
      throw new Error("MapEmbed full mode requires permitsData.");
    }
    return <ZoningExplorer data={data} permitsData={permitsData} className={className} />;
  }

  return (
    <HomeZoningPreview
      data={data}
      interactive={interactive}
      initialViewState={initialViewState}
      className={className}
    />
  );
}
