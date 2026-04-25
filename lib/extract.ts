import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedData } from "@/types/analysis";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert in Finnish housing company documents (isännöitsijäntodistus and financial statements).
Extract structured, factual data from the provided document text.

CRITICAL RULES:
- Return ONLY valid JSON matching the exact schema below — no markdown, no explanation, no code blocks
- Do NOT guess numbers — if a value is not explicitly in the text, return null
- Keep numbers as numbers (not strings)

Finnish synonyms:
- "Hoitovastike" → maintenance_fee_monthly
- "Rahoitusvastike" → financing_fee_monthly
- "Yhtiölaina / osuus" → loan_per_share
- "Velka per m2" → loan_per_m2
- "Rakennusvuosi" → building_year
- "Asuinpinta-ala" → apartment_size_m2

Major renovations: putkiremontti, linjasaneeraus, julkisivuremontti, kattoremontti, peruskorjaus.
Completed → last_major_renovations. Planned → upcoming_repairs.`;

export async function extractFromPDF(text: string): Promise<ExtractedData> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Extract structured real estate data from this Finnish housing document. Return ONLY valid JSON.\n\n---\n\n${text.slice(0, 12000)}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response from Claude");

  const raw = block.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(raw);

  return {
    apartment_size_m2: parsed.apartment_size_m2 ?? null,
    building_year: parsed.building_year ?? null,
    maintenance_fee_monthly: parsed.maintenance_fee_monthly ?? null,
    financing_fee_monthly: parsed.financing_fee_monthly ?? null,
    loan_per_share: parsed.loan_per_share ?? null,
    loan_per_m2: parsed.loan_per_m2 ?? null,
    housing_company_debt_total: parsed.housing_company_debt_total ?? null,
    repair_fund: parsed.repair_fund ?? null,
    owns_land: typeof parsed.owns_land === "boolean" ? parsed.owns_land : null,
    ground_rent_monthly: parsed.ground_rent_monthly ?? null,
    lease_end_year: parsed.lease_end_year ?? null,
    last_major_renovations: Array.isArray(parsed.last_major_renovations)
      ? parsed.last_major_renovations
      : [],
    upcoming_repairs: Array.isArray(parsed.upcoming_repairs) ? parsed.upcoming_repairs : [],
    red_flags_detected: Array.isArray(parsed.red_flags_detected) ? parsed.red_flags_detected : [],
  };
}
