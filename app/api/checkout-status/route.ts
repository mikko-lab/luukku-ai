import { NextRequest, NextResponse } from "next/server";
import type { AnalysisResult } from "@/types/analysis";
import { db } from "@/src/lib/db";
import { getCheckoutStatusRatelimit, getClientIp } from "@/src/lib/ratelimit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = getCheckoutStatusRatelimit();
  if (rl) {
    const { success } = await rl.limit(`status:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Liian monta pyyntöä, odota hetki" },
        { status: 429 },
      );
    }
  }

  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "session_id puuttuu" }, { status: 400 });
  }

  // Access by stripe_session_id (~65 random chars from Stripe). The buyer
  // gets it back via success_url; nobody else has it.
  //
  // Note on lifecycle: stripe_session_id is set on the AnalysisLog row
  // atomically with paid=true by the webhook, not by /api/checkout. So
  // before the webhook lands the row is unfindable by session_id (404),
  // and after it lands it's always paid=true. Polling clients can treat
  // 404 as "still processing" and 200 as "done".
  const analysis = await db.analysisLog.findUnique({
    where: { stripe_session_id: sessionId },
    select: {
      address: true,
      broker_logo: true,
      paid: true,
      paid_at: true,
      emailed_at: true,
      result_json: true,
    },
  });

  if (!analysis) {
    return NextResponse.json({ error: "Maksua ei löydy" }, { status: 404 });
  }

  return NextResponse.json({
    address: analysis.address ?? "Kohde",
    broker_logo: analysis.broker_logo,
    paid: analysis.paid,
    paid_at: analysis.paid_at,
    email_delivered: !!analysis.emailed_at,
    result: analysis.result_json as unknown as AnalysisResult | null,
  });
}
