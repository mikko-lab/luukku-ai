import Anthropic from "@anthropic-ai/sdk";
import type { HousingData } from "@/src/models/housingModel";
import { safeParse, ensureSchema, ensureRepairsSchema } from "@/src/utils/parseGuard";
import { log, logWarn, logTiming } from "@/src/utils/logger";

const SERVICE = "llmExtractor";
const MODEL = "claude-haiku-4-5";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/* ------------------------------------------------------------------ */
/*  Core Claude call — never throws on bad JSON                         */
/* ------------------------------------------------------------------ */

async function callClaude(system: string, prompt: string): Promise<unknown> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Claude returned non-text block");

  return safeParse(block.text);
}

/* ------------------------------------------------------------------ */
/*  Pass 1 — raw field extraction                                       */
/* ------------------------------------------------------------------ */

const PASS1_SYSTEM = `You extract real estate data from Finnish housing documents.
Return ONLY valid JSON, no markdown, no explanation.
Finnish synonyms: Hoitovastike=maintenance_fee_monthly, Rahoitusvastike=financing_fee_monthly,
Yhtiölaina/osuus=loan_per_share, Velka/m2=loan_per_m2, Rakennusvuosi=building_year,
Asuinpinta-ala=apartment_size_m2, Korjausrahasto=repair_fund.
Use null for missing values. Numbers only (no strings like "200 €").
CRITICAL: maintenance_fee_monthly and financing_fee_monthly must be the TOTAL monthly fee for this apartment in euros.
If the document lists fees per share (€/osake/kk), multiply by the apartment's share count to get the total.
If the document lists fees per m² (€/m²/kk), multiply by apartment_size_m2 to get the total.
Never return per-share or per-m² rates as the fee — always return the apartment's total monthly cost.`;

async function extractRaw(text: string) {
  log(SERVICE, "Pass 1: raw extraction...");
  const t = Date.now();

  const raw = await callClaude(
    PASS1_SYSTEM,
    `Extract these fields from the Finnish housing document below.
Return ONLY JSON:
- maintenance_fee_monthly (number|null) — TOTAL €/kk for this apartment. If document shows €/osake/kk, find the apartment share count (osakkeet) and multiply. If €/m²/kk, multiply by apartment_size_m2.
- financing_fee_monthly (number|null) — same rule, total €/kk for this apartment
- loan_per_share (number|null)
- loan_per_m2 (number|null)
- apartment_share_count (number|null) — number of shares (osakkeiden lukumäärä) owned by this apartment
- building_year (number|null)
- apartment_size_m2 (number|null)
- housing_company_debt_total (number|null)
- repair_fund (number|null)
- city (string|null)
- address (string|null)
- repairs_raw (string[] — every sentence mentioning renovations or repairs)

Document:
${text.slice(0, 10000)}`
  );

  const safe = ensureSchema(raw);
  logTiming(SERVICE, "Pass 1", t);

  const fieldsFound = Object.entries(safe)
    .filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0))
    .map(([k]) => k);
  log(SERVICE, `Pass 1 fields found: [${fieldsFound.join(", ")}]`);
  log(SERVICE, "Pass 1 raw financials", {
    maintenance_fee_monthly: safe.maintenance_fee_monthly,
    financing_fee_monthly: safe.financing_fee_monthly,
    apartment_share_count: safe.apartment_share_count,
    apartment_size_m2: safe.apartment_size_m2,
    loan_per_share: safe.loan_per_share,
    repair_fund: safe.repair_fund,
  });

  // Unit correction: if fee looks like a per-share or per-m² rate instead of total monthly cost,
  // try to recover by multiplying. Finnish hoitovastike is never below ~50€/kk for any apartment.
  const MIN_PLAUSIBLE_FEE = 50;
  for (const field of ["maintenance_fee_monthly", "financing_fee_monthly"] as const) {
    const fee = safe[field];
    if (fee === null) continue;

    if (fee >= MIN_PLAUSIBLE_FEE) continue; // looks fine

    // Try: fee * share_count (per-share rate)
    if (safe.apartment_share_count !== null && safe.apartment_share_count > 1) {
      const corrected = fee * safe.apartment_share_count;
      if (corrected >= MIN_PLAUSIBLE_FEE) {
        logWarn(SERVICE, `${field}: ${fee} looks like per-share rate — correcting to ${corrected} (× ${safe.apartment_share_count} shares)`);
        safe[field] = Math.round(corrected);
        continue;
      }
    }

    // Try: fee * size_m2 (per-m² rate)
    if (safe.apartment_size_m2 !== null && safe.apartment_size_m2 > 0) {
      const corrected = fee * safe.apartment_size_m2;
      if (corrected >= MIN_PLAUSIBLE_FEE) {
        logWarn(SERVICE, `${field}: ${fee} looks like per-m² rate — correcting to ${corrected} (× ${safe.apartment_size_m2} m²)`);
        safe[field] = Math.round(corrected);
        continue;
      }
    }

    // Can't correct — null it so the default kicks in
    logWarn(SERVICE, `${field}: ${fee} is implausibly low and uncorrectable — nulling`);
    safe[field] = null;
  }

  return safe;
}

/* ------------------------------------------------------------------ */
/*  Pass 2 — structure repairs                                          */
/* ------------------------------------------------------------------ */

const PASS2_SYSTEM = `You structure raw Finnish housing repair data into clean JSON.
Return ONLY valid JSON, no markdown. Do not invent values.
completed/done repairs → last_major_renovations, planned/future → upcoming_repairs.
Major types: putkiremontti, linjasaneeraus, julkisivuremontti, kattoremontti, peruskorjaus, kylpyhuoneremontti, märkätilaremontti.
Synonyms: märkätila=kylpyhuoneremontti, linjasaneeraus=putkiremontti (use the exact term from the document).
Time: "tehty 2018"→year=2018, "2026-2028"→planned_year=2027 (midpoint), "tulevina vuosina"→null+confidence=low.`;

async function structureRepairs(raw: { repairs_raw: string[] }) {
  log(SERVICE, "Pass 2: structuring repairs...");
  const t = Date.now();

  if (raw.repairs_raw.length === 0) {
    logWarn(SERVICE, "Pass 1 found no repair sentences — skipping Pass 2");
    return ensureRepairsSchema(null);
  }

  const result = await callClaude(
    PASS2_SYSTEM,
    `Structure these repair mentions into clean JSON.

Return ONLY:
{
  "last_major_renovations": [{ "type": string, "year": number|null }],
  "upcoming_repairs": [{ "type": string, "planned_year": number|null, "confidence": "high"|"medium"|"low" }]
}

Repair sentences:
${JSON.stringify(raw.repairs_raw)}`
  );

  const safe = ensureRepairsSchema(result);
  logTiming(SERVICE, "Pass 2", t);
  log(SERVICE, `Pass 2: ${safe.last_major_renovations.length} done, ${safe.upcoming_repairs.length} upcoming`);

  return safe;
}

/* ------------------------------------------------------------------ */
/*  Main export                                                          */
/* ------------------------------------------------------------------ */

export async function extractHousingData(text: string): Promise<HousingData> {
  log(SERVICE, `Starting 2-pass extraction (${text.length} chars)`);

  const raw = await extractRaw(text);
  const repairs = await structureRepairs(raw);

  return {
    location: {
      city: raw.city,
      address: raw.address,
      coordinates: null,
      area_type: null,
    },
    financials: {
      maintenance_fee_monthly: raw.maintenance_fee_monthly,
      financing_fee_monthly: raw.financing_fee_monthly,
      loan_per_share: raw.loan_per_share,
      loan_per_m2: raw.loan_per_m2,
      housing_company_debt_total: raw.housing_company_debt_total,
      repair_fund: raw.repair_fund,
    },
    building: {
      year: raw.building_year,
      size_m2: raw.apartment_size_m2,
    },
    repairs: {
      last_major: repairs.last_major_renovations,
      upcoming: repairs.upcoming_repairs,
    },
    market: {
      avg_price_m2: null,
      deviation_percent: null,
    },
  };
}
