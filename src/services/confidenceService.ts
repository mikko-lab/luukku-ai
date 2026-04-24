import type { HousingData } from "@/src/models/housingModel";
import { log } from "@/src/utils/logger";

const SERVICE = "confidenceService";

interface ConfidenceFactor {
  field: string;
  weight: number;
  present: boolean;
}

export interface ConfidenceResult {
  score: number;       // 0–1
  percent: number;     // 0–100
  level: "low" | "medium" | "high";
  missing_fields: string[];
}

export function computeConfidence(data: HousingData): ConfidenceResult {
  const { financials: f, building: b, repairs: r } = data;

  const factors: ConfidenceFactor[] = [
    // Financials (most critical for analysis)
    { field: "Hoitovastike",      weight: 2.0, present: f.maintenance_fee_monthly !== null },
    { field: "Laina/osake",       weight: 1.5, present: f.loan_per_share !== null || f.loan_per_m2 !== null },
    { field: "Rahoitusvastike",   weight: 1.0, present: f.financing_fee_monthly !== null },
    { field: "Korjausrahasto",    weight: 0.5, present: f.repair_fund !== null },

    // Building
    { field: "Rakennusvuosi",     weight: 1.0, present: b.year !== null },
    { field: "Pinta-ala",         weight: 0.5, present: b.size_m2 !== null },

    // Repairs (high value — drives risk calculation)
    { field: "Remonttihistoria",  weight: 1.5, present: r.last_major.length > 0 },
    { field: "Tulevat remontit",  weight: 2.0, present: r.upcoming.length > 0 },
  ];

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const earnedWeight = factors.filter((f) => f.present).reduce((s, f) => s + f.weight, 0);

  const score = Math.round((earnedWeight / totalWeight) * 100) / 100;
  const percent = Math.round(score * 100);
  const level: ConfidenceResult["level"] =
    score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "low";

  const missing_fields = factors.filter((f) => !f.present).map((f) => f.field);

  log(SERVICE, `Confidence: ${percent}% (${level})`, {
    present: factors.filter((f) => f.present).map((f) => f.field),
    missing: missing_fields,
  });

  return { score, percent, level, missing_fields };
}
