import type { ExtractedData } from "@/types/analysis";

const MAJOR_REPAIR_KEYWORDS = [
  "putkiremontti",
  "linjasaneeraus",
  "julkisivu",
  "katto",
  "peruskorjaus",
];

const REPAIR_COST_ESTIMATES: Record<string, number> = {
  putkiremontti: 15000,
  linjasaneeraus: 15000,
  julkisivu: 8000,
  julkisivuremontti: 8000,
  katto: 5000,
  kattoremontti: 5000,
  peruskorjaus: 20000,
};

function isMajorRepair(type: string): boolean {
  const lower = type.toLowerCase();
  return MAJOR_REPAIR_KEYWORDS.some((kw) => lower.includes(kw));
}

function repairCostEstimate(type: string): number {
  const lower = type.toLowerCase();
  for (const [key, cost] of Object.entries(REPAIR_COST_ESTIMATES)) {
    if (lower.includes(key)) return cost;
  }
  return 3000;
}

export function computeAnalysis(data: ExtractedData) {
  const currentYear = new Date().getFullYear();
  let score = 5;
  const redFlags: string[] = [];

  // +2 if major repair within 5 years
  const soonMajorRepairs = data.upcoming_repairs.filter(
    (r) =>
      isMajorRepair(r.type) &&
      r.planned_year !== null &&
      r.planned_year <= currentYear + 5
  );
  if (soonMajorRepairs.length > 0) {
    score += 2;
    soonMajorRepairs.forEach((r) => {
      redFlags.push(
        `${r.type}${r.planned_year ? ` within ${r.planned_year - currentYear} year(s)` : " planned soon"}`
      );
    });
  }

  // +1 if loan_per_share > 3000
  if (data.loan_per_share !== null && data.loan_per_share > 3000) {
    score += 1;
    redFlags.push(`High debt per share (${data.loan_per_share.toLocaleString("fi-FI")} €)`);
  }

  // +1 if building < 1990 and no recent renovations
  if (data.building_year !== null && data.building_year < 1990) {
    const hasRecentReno = data.last_major_renovations.some(
      (r) => r.year !== null && r.year >= currentYear - 10
    );
    if (!hasRecentReno) {
      score += 1;
      redFlags.push(
        `Old building (${data.building_year}) with no recent major renovations`
      );
    }
  }

  // -1 if major renovation done in last 10 years
  const hasRecentMajor = data.last_major_renovations.some(
    (r) =>
      r.year !== null &&
      r.year >= currentYear - 10 &&
      isMajorRepair(r.type)
  );
  if (hasRecentMajor) score -= 1;

  // -1 if low debt
  const lowDebt =
    (data.loan_per_share !== null && data.loan_per_share < 1000) ||
    (data.loan_per_m2 !== null && data.loan_per_m2 < 100);
  if (lowDebt) score -= 1;

  // Append OpenAI-detected red flags not already covered
  data.red_flags_detected.forEach((rf) => {
    if (!redFlags.some((f) => f.toLowerCase().includes(rf.issue.toLowerCase().slice(0, 10)))) {
      redFlags.push(rf.issue);
    }
  });

  const risk_score = Math.max(0, Math.min(10, score));

  // Monthly cost
  const maintenance = data.maintenance_fee_monthly ?? 200;
  const financing = data.financing_fee_monthly ?? 0;

  const upcomingRepairTotal = data.upcoming_repairs
    .filter((r) => r.planned_year === null || r.planned_year <= currentYear + 10)
    .reduce((sum, r) => sum + repairCostEstimate(r.type), 0);

  const monthly_cost = Math.round(maintenance + financing + upcomingRepairTotal / 60);

  return {
    risk_score,
    monthly_cost,
    upcoming_repairs: data.upcoming_repairs,
    red_flags: redFlags,
    extracted: data,
  };
}
