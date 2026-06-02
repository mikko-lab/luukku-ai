import { NextRequest, NextResponse } from "next/server";
import type { AnalysisResult } from "@/types/analysis";
import { getReportRatelimit, getClientIp } from "@/src/lib/ratelimit";
import { renderReportPdf } from "@/src/services/reportRenderer";
import { db } from "@/src/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = getReportRatelimit();
    if (rl) {
      const { success } = await rl.limit(`report:${ip}`);
      if (!success) {
        return NextResponse.json(
          { error: "Liian monta pyyntöä, odota hetki" },
          { status: 429 },
        );
      }
    }

    const { stripe_session_id } = (await req.json()) as {
      stripe_session_id?: string;
    };
    if (!stripe_session_id) {
      return NextResponse.json(
        { error: "stripe_session_id puuttuu" },
        { status: 400 },
      );
    }

    // stripe_session_id is the access token. Only the buyer who completed
    // the Stripe checkout has it (Stripe sets it on the success_url
    // redirect). Without it the row is unreachable.
    const analysis = await db.analysisLog.findUnique({
      where: { stripe_session_id },
      select: {
        paid: true,
        address: true,
        broker_logo: true,
        result_json: true,
      },
    });

    if (!analysis) {
      return NextResponse.json({ error: "Raporttia ei löydy" }, { status: 404 });
    }
    if (!analysis.paid) {
      // Should not normally happen — stripe_session_id is set on the row
      // only at the same moment paid flips to true. Return 402 anyway as
      // a defensive measure if someone hits the route before the webhook.
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
