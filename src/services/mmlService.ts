import type { HousingData, LocationData } from "@/src/models/housingModel";
import { log } from "@/src/utils/logger";

const SERVICE = "mmlService";

// City → approximate center coordinates [lat, lng]
const CITY_COORDS: Record<string, [number, number]> = {
  helsinki: [60.1699, 24.9384],
  espoo: [60.205, 24.6559],
  tampere: [61.4978, 23.7610],
  vantaa: [60.2934, 25.0378],
  oulu: [65.0121, 25.4651],
  turku: [60.4518, 22.2666],
  jyväskylä: [62.2426, 25.7473],
  lahti: [60.9827, 25.6612],
  kuopio: [62.8924, 27.6772],
  kouvola: [60.8679, 26.7042],
  default: [61.9241, 25.7482], // Finland center
};

function resolveCoordinates(city: string | null): [number, number] {
  if (!city) return CITY_COORDS.default;
  const key = city.toLowerCase().replace(/[^a-zäöå]/g, "");
  return CITY_COORDS[key] ?? CITY_COORDS.default;
}

function resolveAreaType(city: string | null): LocationData["area_type"] {
  if (!city) return null;
  const major = ["helsinki", "espoo", "tampere", "vantaa", "oulu", "turku"];
  const normalized = city.toLowerCase();
  if (major.some((c) => normalized.includes(c))) return "urban";
  return "suburban";
}

// Real interface: getLocationData(address: string) → call MML WFS/API
// Mock implementation for MVP
export async function getLocationData(data: HousingData): Promise<HousingData> {
  log(SERVICE, `Resolving location for city: ${data.location.city ?? "unknown"}`);

  const coordinates = resolveCoordinates(data.location.city);
  const area_type = resolveAreaType(data.location.city);

  log(SERVICE, `Location resolved`, { coordinates, area_type });

  return {
    ...data,
    location: {
      ...data.location,
      coordinates,
      area_type,
    },
  };
}
