import type { HousingData } from "@/src/models/housingModel";
import { log } from "@/src/utils/logger";

const SERVICE = "statsService";

// Source: Tilastokeskus / KVKL — approximate 2024 median €/m2
const AREA_PRICING: Record<string, number> = {
  helsinki: 5800,
  espoo: 4800,
  vantaa: 3600,
  tampere: 3200,
  turku: 3000,
  oulu: 2400,
  jyväskylä: 2600,
  lahti: 2200,
  kuopio: 2500,
  kouvola: 1400,
  default: 2800,
};

function getMedianPriceM2(city: string | null): number {
  if (!city) return AREA_PRICING.default;
  const key = city.toLowerCase().replace(/[^a-zäöå]/g, "");
  return AREA_PRICING[key] ?? AREA_PRICING.default;
}

function computeDeviation(actual: number | null, avg: number): number | null {
  if (actual === null) return null;
  return Math.round(((actual - avg) / avg) * 100);
}

// Real interface: getAreaPricing(city, postcode) → call Tilastokeskus StatFin API
// Mock implementation for MVP
export async function getAreaPricing(data: HousingData): Promise<HousingData> {
  const city = data.location.city;
  log(SERVICE, `Fetching area pricing for: ${city ?? "unknown"}`);

  const avg_price_m2 = getMedianPriceM2(city);

  // Deviation: compare actual loan burden vs regional avg (proxy for value)
  const deviation_percent = computeDeviation(data.financials.loan_per_m2, avg_price_m2 * 0.15);

  log(SERVICE, "Area pricing resolved", { avg_price_m2, deviation_percent });

  return {
    ...data,
    market: {
      avg_price_m2,
      deviation_percent,
    },
  };
}
