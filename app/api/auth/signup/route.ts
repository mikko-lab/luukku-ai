import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/src/lib/db";
import { setSession } from "@/src/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { email, password, office_name } = await req.json();

  if (!email || !password || !office_name) {
    return NextResponse.json({ error: "Täytä kaikki kentät" }, { status: 400 });
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
