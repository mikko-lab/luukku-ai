import { NextRequest, NextResponse } from "next/server";
import type { AnalysisResult } from "@/types/analysis";
import { getSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Kirjaudu sisään" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id puuttuu" }, { status: 400 });
  }

  const analysis = await db.analysisLog.findUnique({
    where: { id },
    select: {
      id: true,
      user_id: true,
      address: true,
      broker_logo: true,
      paid: true,
      paid_at: true,
      emailed_at: true,
      result_json: true,
    },
  });

  // Same 404 for missing and not-owned.
  if (!analysis || analysis.user_id !== session.userId) {
    return NextResponse.json({ error: "Analyysiä ei löydy" }, { status: 404 });
  }

  return NextResponse.json({
    analysisId: analysis.id,
    address: analysis.address ?? "Kohde",
    broker_logo: analysis.broker_logo,
    paid: analysis.paid,
    paid_at: analysis.paid_at,
    email_delivered: !!analysis.emailed_at,
    result: analysis.result_json as unknown as AnalysisResult | null,
  });
}
