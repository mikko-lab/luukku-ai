import { NextRequest, NextResponse } from "next/server";
import { extractPdfText } from "@/src/services/pdfExtractor";
import { normalizeText } from "@/src/utils/normalize";
import { extractHousingData } from "@/src/services/llmExtractor";
import { validateHousingData } from "@/src/services/validationService";
import { getLocationData } from "@/src/services/mmlService";
import { getAreaPricing } from "@/src/services/statsService";
import { computeAnalysis } from "@/src/services/scoringService";
import { computeConfidence } from "@/src/services/confidenceService";
import { withTimeout } from "@/src/utils/withTimeout";
import { log, logError } from "@/src/utils/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const SERVICE = "route/analyze";

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 8);
  log(SERVICE, `=== New analysis request [${requestId}] ===`);

  try {
    // 1. File validation
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

    log(SERVICE, `File: ${file.name} (${Math.round(file.size / 1024)} KB)`);
    const buffer = Buffer.from(await file.arrayBuffer());

    // 2. PDF → text
    const rawText = await extractPdfText(buffer);

    // 3. Normalize
    log(SERVICE, "Normalizing text...");
    const text = normalizeText(rawText);

    // 4. LLM extraction (2-pass)
    let data = await extractHousingData(text);

    // 5. Validate
    data = validateHousingData(data);

    // 6. Enrich: location + market (run in parallel, timeout-guarded)
    log(SERVICE, "Enriching with external data...");
    const [enrichedLocation, enrichedMarket] = await Promise.all([
      withTimeout(getLocationData(data), 1000, "mml"),
      withTimeout(getAreaPricing(data), 1000, "stats"),
    ]);

    data = {
      ...data,
      location: enrichedLocation?.location ?? data.location,
      market: enrichedMarket?.market ?? data.market,
    };

    // 7. Confidence
    const confidence = computeConfidence(data);

    // 8. Score
    const analysis = computeAnalysis(data, confidence.score);

    log(SERVICE, `=== Request [${requestId}] complete — risk: ${analysis.risk_score}/10, confidence: ${confidence.percent}% ===`);

    // 9. Return API response
    return NextResponse.json({
      verdict: analysis.verdict,
      risk_score: analysis.risk_score,
      monthly_cost: analysis.monthly_cost,
      market_position: analysis.market_position,
      confidence: analysis.confidence,
      factors: analysis.scoring_factors,
      red_flags: analysis.red_flags,
      upcoming_repairs: data.repairs.upcoming,
      extracted: {
        apartment_size_m2: data.building.size_m2,
        building_year: data.building.year,
        maintenance_fee_monthly: data.financials.maintenance_fee_monthly,
        financing_fee_monthly: data.financials.financing_fee_monthly,
        loan_per_share: data.financials.loan_per_share,
        loan_per_m2: data.financials.loan_per_m2,
        housing_company_debt_total: data.financials.housing_company_debt_total,
        repair_fund: data.financials.repair_fund,
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
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
