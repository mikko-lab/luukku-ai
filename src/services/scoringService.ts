import type {
  HousingData,
  AnalysisOutput,
  ScoringFactor,
  UpcomingRepair,
} from "@/src/models/housingModel";
import { repairWeight } from "@/src/services/repairClassificationService";
import { log } from "@/src/utils/logger";

const SERVICE = "scoringService";
const CURRENT_YEAR = new Date().getFullYear();

/* ------------------------------------------------------------------ */
/*  Repair cost estimates (€ per m2 of apartment)                       */
/* ------------------------------------------------------------------ */

const REPAIR_COST_PER_M2: Record<string, number> = {
  putkiremontti: 750,
  linjasaneeraus: 750,
  julkisivu: 300,
  julkisivuremontti: 300,
  katto: 200,
  kattoremontti: 200,
  peruskorjaus: 600,
  hissi: 100,
  salaojat: 80,
  parkkihalli: 120,
};

const REPAIR_COST_FLAT: Record<string, number> = {
  putkiremontti: 45_000,
  linjasaneeraus: 45_000,
  julkisivu: 18_000,
  julkisivuremontti: 18_000,
  katto: 12_000,
  kattoremontti: 12_000,
  peruskorjaus: 36_000,
  hissi: 6_000,
  salaojat: 5_000,
  parkkihalli: 7_000,
};

function estimateRepairCost(type: string, size_m2: number | null): number {
  const t = type.toLowerCase();
  for (const [key, costPerM2] of Object.entries(REPAIR_COST_PER_M2)) {
    if (t.includes(key)) {
      return size_m2 ? size_m2 * costPerM2 : (REPAIR_COST_FLAT[key] ?? 10_000);
    }
  }
  return size_m2 ? size_m2 * 150 : 9_000;
}

/* ------------------------------------------------------------------ */
/*  Repair impact map  (negative = reduces risk)                        */
/* ------------------------------------------------------------------ */

const REPAIR_IMPACT: Record<string, { weight: number; category: string }> = {
  putkiremontti:    { weight: -3,   category: "major" },
  linjasaneeraus:   { weight: -3,   category: "major" },
  julkisivu:        { weight: -2,   category: "major" },
  julkisivuremontti:{ weight: -2,   category: "major" },
  kattoremontti:    { weight: -2,   category: "major" },
  katto:            { weight: -2,   category: "major" },
  peruskorjaus:     { weight: -2.5, category: "major" },
  ikkunat:          { weight: -1,   category: "medium" },
  ilmanvaihto:      { weight: -1,   category: "medium" },
  lämpöpumppu:      { weight: -0.3, category: "minor" },
  vesikouru:        { weight: -0.2, category: "minor" },
  maalaus:          { weight: -0.2, category: "minor" },
};

function calculateRepairImpact(renovations: HousingData["repairs"]["last_major"]): number {
  let impact = 0;
  for (const r of renovations) {
    // Pre-2000 repairs no longer "save" the building
    if (r.year !== null && r.year < 2000) continue;

    const t = r.type.toLowerCase();
    const key = Object.keys(REPAIR_IMPACT).find((k) => t.includes(k));
    if (key) impact += REPAIR_IMPACT[key].weight;
  }
  return impact;
}

/* ------------------------------------------------------------------ */
/*  Building risk model                                                  */
/* ------------------------------------------------------------------ */

function buildingRiskModel(
  buildingYear: number,
  repairs: HousingData["repairs"]
): { risk: number; flags: string[] } {
  const age = CURRENT_YEAR - buildingYear;
  let risk = 0;
  const flags: string[] = [];

  const hasDone = (keyword: string) =>
    repairs.last_major.some((r) => r.type.toLowerCase().includes(keyword));
  const hasPlanned = (keyword: string) =>
    repairs.upcoming.some((r) => r.type.toLowerCase().includes(keyword));
  const has = (keyword: string) => hasDone(keyword) || hasPlanned(keyword);

  if (age > 40 && !has("putki") && !has("linjasaneeraus")) {
    risk += 3;
    flags.push("Putkiremontti todennäköinen lähivuosina");
  }

  if (age > 35 && !has("julkisivu")) {
    risk += 2;
    flags.push("Julkisivuremontti mahdollinen");
  }

  if (age > 30 && !has("katto")) {
    risk += 1.5;
    flags.push("Kattoremontti lähestyy");
  }

  return { risk, flags };
}

/* ------------------------------------------------------------------ */
/*  Upcoming major repair check                                          */
/* ------------------------------------------------------------------ */

function soonMajorRepairs(upcoming: UpcomingRepair[], withinYears: number): UpcomingRepair[] {
  return upcoming.filter(
    (r) => r.category === "major" && (r.planned_year === null || r.planned_year <= CURRENT_YEAR + withinYears)
  );
}

/* ------------------------------------------------------------------ */
/*  Risk scoring                                                         */
/* ------------------------------------------------------------------ */

function computeRiskScore(data: HousingData): { score: number; factors: ScoringFactor[] } {
  const factors: ScoringFactor[] = [];
  let score = 5;

  const { financials: f, building: b, repairs: r } = data;

  // ── Building risk model ───────────────────────────────────────────────
  if (b.year !== null) {
    const building = buildingRiskModel(b.year, r);
    const repairImpact = calculateRepairImpact(r.last_major);
    // Repairs can cancel building risk but max bonus is -1 (prevents score collapsing with many past repairs)
    const netImpact = Math.round(Math.max(-1, building.risk + repairImpact) * 10) / 10;

    if (netImpact > 0) {
      // Building is at risk — show what's missing
      factors.push({
        label: "Rakennuksen ikä & puuttuvat remontit",
        impact: netImpact,
        reason: building.flags.join(", "),
      });
      score += netImpact;
    } else if (netImpact < 0) {
      // Repairs have been done well
      const doneRenovations = r.last_major
        .filter((reno) => reno.year !== null && reno.year >= 2000 && reno.category === "major")
        .map((reno) => `${reno.type} (${reno.year})`)
        .join(", ");
      factors.push({
        label: "Isot remontit tehty",
        impact: netImpact,
        reason: doneRenovations || `Rak. ${b.year}`,
      });
      score += netImpact;
    }

    // Building flags always visible in red_flags even when repairs offset them
    for (const flag of building.flags) {
      factors.push({ label: flag, impact: 0, reason: `Rak. ${b.year}` });
    }
  }

  // ── Upcoming major repairs ────────────────────────────────────────────
  const soon5 = soonMajorRepairs(r.upcoming, 5);
  const soon10 = soonMajorRepairs(r.upcoming, 10);

  if (soon5.length > 0) {
    const impact = soon5.length === 1 ? 2 : 2.5;
    factors.push({
      label: "Iso remontti lähellä",
      impact,
      reason: soon5.map((x) => `${x.type}${x.planned_year ? ` (${x.planned_year})` : ""}`).join(", "),
    });
    score += impact;
  } else if (soon10.length > 0) {
    factors.push({
      label: "Iso remontti tulossa (5–10v)",
      impact: 1,
      reason: soon10.map((x) => `${x.type}${x.planned_year ? ` (${x.planned_year})` : ""}`).join(", "),
    });
    score += 1;
  }

  // ── Loan per share ───────────────────────────────────────────────────
  if (f.loan_per_share !== null) {
    if (f.loan_per_share > 5000) {
      factors.push({ label: "Erittäin korkea laina/osake", impact: 2, reason: `${f.loan_per_share.toLocaleString("fi-FI")} €` });
      score += 2;
    } else if (f.loan_per_share > 3000) {
      factors.push({ label: "Korkea laina/osake", impact: 1, reason: `${f.loan_per_share.toLocaleString("fi-FI")} €` });
      score += 1;
    } else if (f.loan_per_share < 500) {
      factors.push({ label: "Matala laina/osake", impact: -1, reason: `${f.loan_per_share.toLocaleString("fi-FI")} €` });
      score -= 1;
    }
  }

  // ── No repair fund data ───────────────────────────────────────────────
  if (f.repair_fund === null) {
    factors.push({ label: "Korjausrahastotieto puuttuu", impact: 0.5, reason: "Ei tietoa puskurista" });
    score += 0.5;
  } else if (f.repair_fund < 10_000) {
    factors.push({ label: "Pieni korjausrahasto", impact: 0.5, reason: `${f.repair_fund.toLocaleString("fi-FI")} €` });
    score += 0.5;
  }

  const clampedScore = Math.round(Math.max(0, Math.min(10, score)) * 10) / 10;
  return { score: clampedScore, factors };
}

/* ------------------------------------------------------------------ */
/*  Monthly cost                                                         */
/* ------------------------------------------------------------------ */

function computeMonthlyCost(data: HousingData): number {
  const f = data.financials;
  const size = data.building.size_m2;

  const base =
    (f.maintenance_fee_monthly ?? 200) +
    (f.financing_fee_monthly ?? 0);

  // Only amortize major and unknown upcoming repairs — minor repairs are noise
  // repairWeight is for risk scoring only, not cost multiplication
  const repairMonthly = data.repairs.upcoming
    .filter((r) => r.category !== "minor" && (r.planned_year === null || r.planned_year <= CURRENT_YEAR + 10))
    .reduce((sum, r) => sum + estimateRepairCost(r.type, size) / 60, 0);

  return Math.round(base + repairMonthly);
}

/* ------------------------------------------------------------------ */
/*  Market position                                                      */
/* ------------------------------------------------------------------ */

function computeMarketPosition(
  data: HousingData,
  riskScore: number
): AnalysisOutput["market_position"] {
  const { avg_price_m2, deviation_percent } = data.market;

  if (deviation_percent !== null) {
    if (deviation_percent > 30) return "overpriced";
    if (deviation_percent < -20) return "undervalued";
    return "fair";
  }

  // Fallback: use risk score as proxy
  if (riskScore >= 7) return "overpriced";
  if (riskScore <= 3) return "undervalued";
  return "fair";
}

/* ------------------------------------------------------------------ */
/*  Red flags                                                            */
/* ------------------------------------------------------------------ */

function generateRedFlags(data: HousingData, factors: ScoringFactor[]): string[] {
  const flags: string[] = [];

  const { financials: f, building: b, repairs: r } = data;

  // From scoring factors — include building flags (impact === 0) and risk factors (impact > 0)
  factors.filter((fac) => fac.impact >= 0).forEach((fac) => {
    flags.push(fac.impact === 0 ? fac.label : `${fac.label}: ${fac.reason}`);
  });

  // Extra flags not captured in scoring
  const highConfidenceUpcoming = r.upcoming.filter((x) => x.confidence === "high" && x.category !== "major");
  highConfidenceUpcoming.forEach((rep) => {
    flags.push(`Remontti tulossa: ${rep.type}${rep.planned_year ? ` (${rep.planned_year})` : ""}`);
  });

  if (f.financing_fee_monthly !== null && f.financing_fee_monthly > 500) {
    flags.push(`Korkea rahoitusvastike: ${f.financing_fee_monthly} €/kk`);
  }

  if (b.year !== null && b.year < 1960) {
    flags.push(`Rakennus erittäin vanha: ${b.year}`);
  }

  return Array.from(new Set(flags)); // deduplicate
}

/* ------------------------------------------------------------------ */
/*  Main export                                                          */
/* ------------------------------------------------------------------ */

function getVerdict(score: number): AnalysisOutput["verdict"] {
  if (score >= 8) return "ÄLÄ OSTA";
  if (score >= 6) return "HARKITSE TARKKAAN";
  return "HYVÄ KOHDE";
}

export function computeAnalysis(data: HousingData, confidence: number): AnalysisOutput {
  log(SERVICE, "Computing risk score...");

  const { score: risk_score, factors: scoring_factors } = computeRiskScore(data);
  const monthly_cost = computeMonthlyCost(data);
  const market_position = computeMarketPosition(data, risk_score);
  const red_flags = generateRedFlags(data, scoring_factors);

  log(SERVICE, "Scoring complete", {
    risk_score,
    monthly_cost,
    market_position,
    confidence,
    red_flags_count: red_flags.length,
    factors: scoring_factors.map((f) => `${f.impact > 0 ? "+" : ""}${f.impact} ${f.label}`),
  });

  const verdict = getVerdict(risk_score);

  return { verdict, risk_score, monthly_cost, market_position, confidence, red_flags, scoring_factors };
}
