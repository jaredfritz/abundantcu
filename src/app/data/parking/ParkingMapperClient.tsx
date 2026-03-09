"use client";

import { useSearchParams } from "next/navigation";
import ParkingMapper from "@/components/tools/ParkingMapper";

export default function ParkingMapperClient() {
  const params = useSearchParams();
  const editMode = params.has("edit");
  return <ParkingMapper editMode={editMode} />;
}
