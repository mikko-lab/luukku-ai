import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/src/lib/db";
import { setSession } from "@/src/lib/auth";
import { getAuthRatelimit, getClientIp } from "@/src/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = getAuthRatelimit();
  if (rl) {
    const { success } = await rl.limit(`login:${getClientIp(req)}`);
    if (!success) return NextResponse.json({ error: "Liian monta yritystä" }, { status: 429 });
  }

  const body = await req.json();
  const email: string = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const password: string = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Täytä kaikki kentät" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Väärä sähköposti tai salasana" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Väärä sähköposti tai salasana" }, { status: 401 });
  }

  await setSession(user.id);
  return NextResponse.json({
    id: user.id,
    email: user.email,
    office_name: user.office_name,
    credits_remaining: user.credits_remaining,
  });
}
