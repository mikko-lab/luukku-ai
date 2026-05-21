import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/src/lib/db";
import { setSession } from "@/src/lib/auth";
import { getAuthRatelimit, getClientIp } from "@/src/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = getAuthRatelimit();
  if (rl) {
    const { success } = await rl.limit(`signup:${getClientIp(req)}`);
    if (!success) return NextResponse.json({ error: "Liian monta yritystä" }, { status: 429 });
  }

  const body = await req.json();
  const email: string = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const password: string = typeof body.password === "string" ? body.password : "";
  const office_name: string = typeof body.office_name === "string" ? body.office_name.trim() : "";

  if (!email || !password || !office_name) {
    return NextResponse.json({ error: "Täytä kaikki kentät" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Virheellinen sähköpostiosoite" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Salasanan on oltava vähintään 8 merkkiä" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Sähköposti on jo käytössä" }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: { email, password_hash, office_name, credits_remaining: 20 },
  });

  await setSession(user.id);
  return NextResponse.json({
    id: user.id,
    email: user.email,
    office_name: user.office_name,
    credits_remaining: user.credits_remaining,
  });
}
