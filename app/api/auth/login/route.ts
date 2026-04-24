import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/src/lib/db";
import { setSession } from "@/src/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

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
