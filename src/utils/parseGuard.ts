import { logWarn } from "@/src/utils/logger";

const SERVICE = "parseGuard";

export function safeParse(raw: string): unknown {
  // Strip accidental markdown fences
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    logWarn(SERVICE, "JSON.parse failed — returning null", {
      preview: cleaned.slice(0, 200),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// Ensures the raw LLM output from Pass 1 has a safe, typed shape
export interface RawExtractedFields {
  maintenance_fee_monthly: number | null;
  financing_fee_monthly: number | null;
  loan_per_share: number | null;
  loan_per_m2: number | null;
  building_year: number | null;
  apartment_size_m2: number | null;
  housing_company_debt_total: number | null;
  repair_fund: number | null;
  city: string | null;
  address: string | null;
  repairs_raw: string[];
}

function num(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

export function ensureSchema(data: unknown): RawExtractedFields {
  const d = data as Record<string, unknown> | null | undefined;
  return {
    maintenance_fee_monthly: num(d?.maintenance_fee_monthly),
    financing_fee_monthly: num(d?.financing_fee_monthly),
    loan_per_share: num(d?.loan_per_share),
    loan_per_m2: num(d?.loan_per_m2),
    building_year: num(d?.building_year),
    apartment_size_m2: num(d?.apartment_size_m2),
    housing_company_debt_total: num(d?.housing_company_debt_total),
    repair_fund: num(d?.repair_fund),
    city: str(d?.city),
    address: str(d?.address),
    repairs_raw: Array.isArray(d?.repairs_raw)
      ? (d.repairs_raw as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
  };
}

// Ensures the raw LLM output from Pass 2 has a safe, typed shape
export interface RawRepairsFields {
  last_major_renovations: Array<{ type: string; year: number | null }>;
  upcoming_repairs: Array<{ type: string; planned_year: number | null; confidence: "high" | "medium" | "low" }>;
}

const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

function coerceConfidence(v: unknown): "high" | "medium" | "low" {
  return VALID_CONFIDENCE.has(v as string) ? (v as "high" | "medium" | "low") : "low";
}

export function ensureRepairsSchema(data: unknown): RawRepairsFields {
  const d = data as Record<string, unknown> | null | undefined;

  const lastMajor = Array.isArray(d?.last_major_renovations)
    ? (d.last_major_renovations as unknown[])
        .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
        .map((x) => ({ type: str(x.type) ?? "tuntematon", year: num(x.year) }))
    : [];

  const upcoming = Array.isArray(d?.upcoming_repairs)
    ? (d.upcoming_repairs as unknown[])
        .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
        .map((x) => ({
          type: str(x.type) ?? "tuntematon",
          planned_year: num(x.planned_year),
          confidence: coerceConfidence(x.confidence),
        }))
    : [];

  return { last_major_renovations: lastMajor, upcoming_repairs: upcoming };
}
