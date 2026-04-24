import { NextResponse } from "next/server";
import { clearSession } from "@/src/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
