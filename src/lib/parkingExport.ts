export type ParkingBasemap = "roadmap" | "satellite";
export type ParkingFeatureType = "surface" | "garage";

export interface ParkingExportFeature {
  id: string;
  type: ParkingFeatureType;
  name?: string | null;
  coordinates: [number, number][][];
  created_by?: string;
  created_by_name?: string;
}

export interface ParkingStyleOverrides {
  surfaceFill?: string;
  surfaceBorder?: string;
  garageFill?: string;
  garageBorder?: string;
}

export interface ParkingLegendConfig {
  enabled?: boolean;
  title?: string;
  xPct?: number;
  yPct?: number;
  widthPct?: number;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}
