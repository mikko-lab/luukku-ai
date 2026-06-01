import { NextRequest, NextResponse } from "next/server";
import type { AnalysisResult } from "@/types/analysis";
import { getSession } from "@/src/lib/auth";
import { getReportRatelimit } from "@/src/lib/ratelimit";
import { renderReportPdf } from "@/src/services/reportRenderer";
import { db } from "@/src/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Kirjaudu sisään" }, { status: 401 });
    }

    const rl = getReportRatelimit();
    if (rl) {
      const { success } = await rl.limit(`report:${session.userId}`);
      if (!success) {
        return NextResponse.json(
          { error: "Liian monta pyyntöä, odota hetki" },
          { status: 429 },
        );
      }
    }

    const { analysisId } = (await req.json()) as { analysisId?: string };
    if (!analysisId) {
      return NextResponse.json({ error: "analysisId puuttuu" }, { status: 400 });
    }

    const analysis = await db.analysisLog.findUnique({
      where: { id: analysisId },
      select: {
        id: true,
        user_id: true,
        paid: true,
        address: true,
        broker_logo: true,
        result_json: true,
      },
    });

    // Same 404 for missing and not-owned so we don't reveal which
    // analysisIds exist for other users.
    if (!analysis || analysis.user_id !== session.userId) {
      return NextResponse.json({ error: "Analyysiä ei löydy" }, { status: 404 });
    }
    if (!analysis.paid) {
      return NextResponse.json(
        { error: "Raporttia ei ole maksettu" },
        { status: 402 },
      );
    }
    if (!analysis.result_json) {
      return NextResponse.json(
        { error: "Analyysin data puuttuu" },
        { status: 500 },
      );
    }

    const address = analysis.address ?? "Kohde";
    const buffer = await renderReportPdf({
      result: analysis.result_json as unknown as AnalysisResult,
      address,
      brokerLogo: analysis.broker_logo ?? undefined,
    });

    const filename = `luukku-analyysi-${address.replace(/\s+/g, "-").toLowerCase()}.pdf`;

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
