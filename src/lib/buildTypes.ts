export interface BuildType {
  id: string;
  label: string;
  /** Zones where this use is permitted by right. */
  allowedCodes: string[];
  /** Zones where this use is explicitly not permitted. */
  notAllowedCodes: string[];
}

export const BUILD_TYPES: BuildType[] = [
  {
    id: "sfh",
    label: "Single Family Home",
    allowedCodes: [
      "SF1", "SF2",
      "IT-SF1", "IT-SF2",
      "IT-MR1", "IT-MR2", "IT-MX", "IT-NC",
      "MF1", "MF2", "MF3", "MFUniv",
      "CO", "CN",
    ],
    notAllowedCodes: [
      "CB1", "CB2", "CB3",
      "CG", "CI",
      "I1", "I2", "IOP", "IBP",
      "MHC",
    ],
  },
  {
    id: "duplex",
    label: "Duplex",
    allowedCodes: [
      "SF2", "IT-SF2",
      "MF1", "MF2", "MF3", "MFUniv",
      "IT-MR1", "IT-MR2", "IT-MX",
      "CN", "CO", "CB1", "CB2", "CB3",
    ],
    notAllowedCodes: [
      "SF1", "IT-SF1", "IT-NC",
      "CG", "CI",
      "I1", "I2", "IOP", "IBP",
      "MHC",
    ],
  },
  {
    id: "fourplex",
    label: "Fourplex",
    allowedCodes: [
      "MF1", "MF2", "MF3", "MFUniv",
      "IT-MR1", "IT-MR2", "IT-MX",
      "CO", "CN",
      "CB1", "CB2", "CB3",
    ],
    notAllowedCodes: [
      "SF1", "SF2",
      "IT-SF1", "IT-SF2", "IT-NC",
      "CG", "CI",
      "I1", "I2", "IOP", "IBP",
      "MHC",
    ],
  },
  {
    id: "adu",
    label: "ADU",
    allowedCodes: [
      "SF1", "SF2",
      "MF1", "MF2", "MF3", "MFUniv",
      "MHC",
      "IT-SF1", "IT-SF2",
      "IT-MR1", "IT-MR2", "IT-MX", "IT-NC",
    ],
    notAllowedCodes: [
      "CO", "CN",
      "CG", "CI",
      "CB1", "CB2", "CB3",
      "I1", "I2",
      "IOP", "IBP",
    ],
  },
  {
    id: "cafe",
    label: "Café",
    allowedCodes: ["CN", "CO", "CG", "CI", "CB1", "CB2", "CB3"],
    notAllowedCodes: [
      "SF1", "SF2",
      "IT-SF1", "IT-SF2",
      "IT-MR1", "IT-MR2", "IT-MX", "IT-NC",
      "MF1", "MF2", "MF3", "MFUniv",
      "I1", "I2", "IOP", "IBP",
      "MHC",
    ],
  },
];

export const BUILD_COLORS = {
  allowed: "#0072B2",
  notAllowed: "#D55E00",
} as const;
