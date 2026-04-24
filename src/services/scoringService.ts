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

function isMajor(r: UpcomingRepair | { category?: string; type: string }): boolean {
  return r.category === "major";
}

function soonMajorRepairs(upcoming: UpcomingRepair[], withinYears: number): UpcomingRepair[] {
  return upcoming.filter(
    (r) => isMajor(r) && (r.planned_year === null || r.planned_year <= CURRENT_YEAR + withinYears)
  );
}

/* ------------------------------------------------------------------ */
/*  Risk scoring                                                         */
/* ------------------------------------------------------------------ */

function computeRiskScore(data: HousingData): { score: number; factors: ScoringFactor[] } {
  const factors: ScoringFactor[] = [];
  let score = 5;

  const { financials: f, building: b, repairs: r } = data;

  // ── Upcoming major repairs ──────────────────────────────────────────
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

  // ── Building age ─────────────────────────────────────────────────────
  if (b.year !== null) {
    const hasRecentMajorReno = r.last_major.some(
      (reno) => reno.year !== null && reno.year >= CURRENT_YEAR - 10 && reno.category === "major"
    );

    if (b.year < 1960 && !hasRecentMajorReno) {
      factors.push({ label: "Hyvin vanha rakennus, ei peruskorjauksia", impact: 2, reason: `Rak. ${b.year}` });
      score += 2;
    } else if (b.year < 1990 && !hasRecentMajorReno) {
      factors.push({ label: "Vanha rakennus, ei viimeaikaisia remontteja", impact: 1, reason: `Rak. ${b.year}` });
      score += 1;
    }

    // ── Putkiremontti warning for pre-1990 buildings ──────────────────
    const hasPipeReno = r.last_major.some((reno) => {
      const t = reno.type.toLowerCase();
      return t.includes("putki") || t.includes("linjasaneeraus");
    });
    const pipeUpcoming = r.upcoming.some((reno) => {
      const t = reno.type.toLowerCase();
      return t.includes("putki") || t.includes("linjasaneeraus");
    });

    if (b.year < 1990 && !hasPipeReno && !pipeUpcoming) {
      factors.push({
        label: "Putkiremontti todennäköinen lähivuosina",
        impact: 1.5,
        reason: `Rak. ${b.year}, ei merkintää putkiremontista`,
      });
      score += 1.5;
    }
  }

  // ── Recent major renovation (positive) ───────────────────────────────
  const recentMajor = r.last_major.filter(
    (reno) => reno.year !== null && reno.year >= CURRENT_YEAR - 10 && reno.category === "major"
  );
  if (recentMajor.length > 0) {
    factors.push({
      label: "Iso remontti tehty viime 10v",
      impact: -1,
      reason: recentMajor.map((x) => `${x.type} (${x.year})`).join(", "),
    });
    score -= 1;
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
  const repairMonthly = data.repairs.upcoming
    .filter((r) => r.category !== "minor" && (r.planned_year === null || r.planned_year <= CURRENT_YEAR + 10))
    .reduce((sum, r) => sum + estimateRepairCost(r.type, size) * repairWeight(r.type) / 60, 0);

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

  // From scoring factors (already computed)
  factors.filter((fac) => fac.impact > 0).forEach((fac) => {
    flags.push(`${fac.label}: ${fac.reason}`);
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
