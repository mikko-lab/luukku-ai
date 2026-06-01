import { NextRequest, NextResponse } from "next/server";
import { extractPdfText } from "@/src/services/pdfExtractor";
import { normalizeText } from "@/src/utils/normalize";
import { extractHousingData } from "@/src/services/llmExtractor";
import { validateHousingData } from "@/src/services/validationService";
import { getLocationData } from "@/src/services/mmlService";
import { getAreaPricing } from "@/src/services/statsService";
import { getPopulationData } from "@/src/services/populationService";
import { computeAnalysis, estimateRepairCost } from "@/src/services/scoringService";
import { computeConfidence } from "@/src/services/confidenceService";
import { classifyRepairs } from "@/src/services/repairClassificationService";
import { mergeHousingData } from "@/src/services/mergeService";
import { withTimeout } from "@/src/utils/withTimeout";
import { log, logError } from "@/src/utils/logger";
import { getSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { getAnalyzeRatelimit } from "@/src/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const SERVICE = "route/analyze";

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 8);
  log(SERVICE, `=== New analysis request [${requestId}] ===`);

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Kirjaudu sisään" }, { status: 401 });
  }

  const rl = getAnalyzeRatelimit();
  if (rl) {
    const { success } = await rl.limit(`analyze:${session.userId}`);
    if (!success) {
      return NextResponse.json(
        { error: "Liian monta pyyntöä, odota hetki" },
        { status: 429 },
      );
    }
  }

  // File validation — must happen before charging, so a malformed upload
  // doesn't burn a credit.
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const file2 = formData.get("file2");
  const hasSecondFile = file2 instanceof File && file2.size > 0;

  // Atomic credit reservation BEFORE any paid Claude call. updateMany with
  // a WHERE guard is a single SQL statement, so concurrent requests cannot
  // both observe credits_remaining=1 and both proceed.
  const reserved = await db.user.updateMany({
    where: { id: session.userId, credits_remaining: { gt: 0 } },
    data: { credits_remaining: { decrement: 1 } },
  });
  if (reserved.count === 0) {
    return NextResponse.json(
      { error: "Ei analyysikredittejä jäljellä" },
      { status: 402 },
    );
  }

  try {
    log(SERVICE, `File: ${file.name} (${Math.round(file.size / 1024)} KB)`);
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract from primary file
    const rawText = await extractPdfText(buffer);
    const text = normalizeText(rawText);
    log(SERVICE, "Normalizing text...");

    // 4. LLM extraction — primary
    let data = await extractHousingData(text);

    // 4b. Extract from secondary file and merge
    if (hasSecondFile) {
      log(SERVICE, `Second file: ${file2.name} (${Math.round(file2.size / 1024)} KB)`);
      const buffer2 = Buffer.from(await file2.arrayBuffer());
      const rawText2 = await extractPdfText(buffer2);
      const text2 = normalizeText(rawText2);
      const data2 = await extractHousingData(text2);
      data = mergeHousingData(data, data2);
      log(SERVICE, "Documents merged");
    }

    // 5. Validate
    data = validateHousingData(data);

    // 5b. Classify repairs (major / minor / unknown)
    data = classifyRepairs(data);

    // 6. Enrich: location + market + population (run in parallel, timeout-guarded)
    log(SERVICE, "Enriching with external data...");
    const [enrichedLocation, enrichedMarket, enrichedPopulation] = await Promise.all([
      withTimeout(getLocationData(data), 1000, "mml"),
      withTimeout(getAreaPricing(data), 1000, "stats"),
      withTimeout(getPopulationData(data), 1000, "population"),
    ]);

    data = {
      ...data,
      location: enrichedLocation?.location ?? data.location,
      market: enrichedMarket?.market ?? data.market,
      population: enrichedPopulation?.population ?? data.population,
    };

    // 7. Confidence
    const confidence = computeConfidence(data);

    // 8. Score
    const analysis = computeAnalysis(data, confidence.score);

    log(SERVICE, `=== Request [${requestId}] complete — risk: ${analysis.risk_score}/10, confidence: ${confidence.percent}% ===`);

    // Credit was already reserved before the Claude call; just log the
    // successful analysis here.
    await db.analysisLog.create({
      data: {
        user_id: session.userId,
        request_id: requestId,
        risk_score: analysis.risk_score,
      },
    });

    // Return API response
    return NextResponse.json({
      verdict: analysis.verdict,
      risk_score: analysis.risk_score,
      monthly_cost: analysis.monthly_cost,
      market_position: analysis.market_position,
      confidence: analysis.confidence,
      factors: analysis.scoring_factors,
      red_flags: analysis.red_flags,
      upcoming_repairs: data.repairs.upcoming.map((r) => ({
        ...r,
        cost_estimate_eur: estimateRepairCost(r.type, data.building.size_m2),
      })),
      extracted: {
        apartment_size_m2: data.building.size_m2,
        building_year: data.building.year,
        maintenance_fee_monthly: data.financials.maintenance_fee_monthly,
        financing_fee_monthly: data.financials.financing_fee_monthly,
        loan_per_share: data.financials.loan_per_share,
        loan_per_m2: data.financials.loan_per_m2,
        housing_company_debt_total: data.financials.housing_company_debt_total,
        repair_fund: data.financials.repair_fund,
        energy_class: data.building.energy_class,
        heating_system: data.building.heating_system,
        owns_land: data.land.owns_land,
        ground_rent_monthly: data.land.ground_rent_monthly,
        lease_end_year: data.land.lease_end_year,
        last_major_renovations: data.repairs.last_major,
        upcoming_repairs: data.repairs.upcoming,
        red_flags_detected: [],
        confidence_percent: confidence.percent,
        confidence_level: confidence.level,
        missing_fields: confidence.missing_fields,
      },
    });
  } catch (err) {
    logError(SERVICE, `Request [${requestId}] failed`, err);
    // Refund the reserved credit since the analysis didn't complete.
    // Best-effort; we still return 500 to the client either way.
    try {
      await db.user.update({
        where: { id: session.userId },
        data: { credits_remaining: { increment: 1 } },
      });
    } catch (refundErr) {
      logError(SERVICE, `Credit refund failed for [${requestId}]`, refundErr);
    }
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
