import type { HousingData } from "@/src/models/housingModel";
import { log, logWarn } from "@/src/utils/logger";

const SERVICE = "validationService";

const BOUNDS = {
  maintenance_fee_monthly: { min: 0, max: 5000 },
  financing_fee_monthly: { min: 0, max: 5000 },
  loan_per_share: { min: 0, max: 100_000 },
  loan_per_m2: { min: 0, max: 5000 },
  housing_company_debt_total: { min: 0, max: 100_000_000 },
  repair_fund: { min: 0, max: 10_000_000 },
  building_year: { min: 1800, max: new Date().getFullYear() },
  apartment_size_m2: { min: 10, max: 1000 },
};

function clamp(
  value: number | null,
  field: keyof typeof BOUNDS,
  label: string
): number | null {
  if (value === null) return null;
  const { min, max } = BOUNDS[field];
  if (value < min || value > max) {
    logWarn(SERVICE, `${label} out of range (${value}), nulling`);
    return null;
  }
  return value;
}

export function validateHousingData(data: HousingData): HousingData {
  log(SERVICE, "Validating extracted data...");

  const f = data.financials;
  const b = data.building;

  const validated: HousingData = {
    ...data,
    financials: {
      maintenance_fee_monthly: clamp(f.maintenance_fee_monthly, "maintenance_fee_monthly", "Hoitovastike"),
      financing_fee_monthly: clamp(f.financing_fee_monthly, "financing_fee_monthly", "Rahoitusvastike"),
      loan_per_share: clamp(f.loan_per_share, "loan_per_share", "Laina/osake"),
      loan_per_m2: clamp(f.loan_per_m2, "loan_per_m2", "Laina/m²"),
      housing_company_debt_total: clamp(f.housing_company_debt_total, "housing_company_debt_total", "Yhtiölaina yht."),
      repair_fund: clamp(f.repair_fund, "repair_fund", "Korjausrahasto"),
    },
    building: {
      year: clamp(b.year, "building_year", "Rakennusvuosi"),
      size_m2: clamp(b.size_m2, "apartment_size_m2", "Pinta-ala"),
    },
    repairs: {
      last_major: data.repairs.last_major.filter((r) => r.type && typeof r.type === "string"),
      upcoming: data.repairs.upcoming.filter((r) => r.type && typeof r.type === "string"),
    },
  };

  const nullCount = Object.values(validated.financials).filter((v) => v === null).length;
  log(SERVICE, `Validation done. ${nullCount}/6 financial fields are null.`);

  return validated;
}
