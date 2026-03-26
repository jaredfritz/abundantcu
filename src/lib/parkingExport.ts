export type ParkingBasemap = "roadmap" | "satellite";

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
