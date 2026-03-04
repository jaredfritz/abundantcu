import ZoningClient from "@/components/ZoningClient";

interface ZoningExplorerProps {
  data: GeoJSON.FeatureCollection;
  permitsData: GeoJSON.FeatureCollection;
  className?: string;
}

export default function ZoningExplorer({ data, permitsData, className }: ZoningExplorerProps) {
  return (
    <div className={className}>
      <ZoningClient data={data} permitsData={permitsData} />
    </div>
  );
}
