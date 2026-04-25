import type { HousingData, Renovation, UpcomingRepair } from "@/src/models/housingModel";
import { log } from "@/src/utils/logger";

const SERVICE = "mergeService";

function normalizeRepairKey(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("putki") || t.includes("linjasaneeraus")) return "putkiremontti";
  if (t.includes("julkisivu")) return "julkisivuremontti";
  if (t.includes("katto")) return "kattoremontti";
  if (t.includes("kylpyhuone") || t.includes("märkätila")) return "kylpyhuoneremontti";
  if (t.includes("peruskorjaus")) return "peruskorjaus";
  return t.slice(0, 14);
}

function deduplicateRenovations(repairs: Renovation[]): Renovation[] {
  const best = new Map<string, Renovation>();
  for (const r of repairs) {
    const key = normalizeRepairKey(r.type);
    const existing = best.get(key);
    if (!existing) { best.set(key, r); continue; }
    // Keep most recent year
    if (r.year !== null && (existing.year === null || r.year > existing.year)) {
      best.set(key, r);
    }
  }
  return Array.from(best.values());
}

function deduplicateUpcoming(repairs: UpcomingRepair[]): UpcomingRepair[] {
  const seen = new Set<string>();
  return repairs.filter((r) => {
    const key = r.type.toLowerCase().slice(0, 12);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeHousingData(primary: HousingData, secondary: HousingData): HousingData {
  const merged: HousingData = {
    location: {
      city:        primary.location.city        ?? secondary.location.city,
      address:     primary.location.address     ?? secondary.location.address,
      coordinates: primary.location.coordinates ?? secondary.location.coordinates,
      area_type:   primary.location.area_type   ?? secondary.location.area_type,
    },
    financials: {
      // Primary (isännöitsijäntodistus) wins for apartment-specific financial data
      maintenance_fee_monthly:    primary.financials.maintenance_fee_monthly    ?? secondary.financials.maintenance_fee_monthly,
      financing_fee_monthly:      primary.financials.financing_fee_monthly      ?? secondary.financials.financing_fee_monthly,
      loan_per_share:             primary.financials.loan_per_share             ?? secondary.financials.loan_per_share,
      loan_per_m2:                primary.financials.loan_per_m2               ?? secondary.financials.loan_per_m2,
      housing_company_debt_total: primary.financials.housing_company_debt_total ?? secondary.financials.housing_company_debt_total,
      repair_fund:                primary.financials.repair_fund                ?? secondary.financials.repair_fund,
    },
    building: {
      year:    primary.building.year    ?? secondary.building.year,
      size_m2: primary.building.size_m2 ?? secondary.building.size_m2,
    },
    repairs: {
      // Combine repair histories from both documents, deduplicate by type+year
      last_major: deduplicateRenovations([
        ...primary.repairs.last_major,
        ...secondary.repairs.last_major,
      ]),
      upcoming: deduplicateUpcoming([
        ...primary.repairs.upcoming,
        ...secondary.repairs.upcoming,
      ]),
    },
    market: {
      avg_price_m2:      primary.market.avg_price_m2      ?? secondary.market.avg_price_m2,
      deviation_percent: primary.market.deviation_percent ?? secondary.market.deviation_percent,
    },
  };

  log(SERVICE, "Merged two documents", {
    last_major: merged.repairs.last_major.length,
    upcoming: merged.repairs.upcoming.length,
    gained_fields: [
      !primary.building.size_m2 && secondary.building.size_m2 ? "size_m2" : null,
      !primary.building.year && secondary.building.year ? "building_year" : null,
      !primary.financials.maintenance_fee_monthly && secondary.financials.maintenance_fee_monthly ? "maintenance_fee" : null,
    ].filter(Boolean),
  });

  return merged;
}
