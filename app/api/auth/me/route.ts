import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { db } from "@/src/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    office_name: user.office_name,
    credits_remaining: user.credits_remaining,
  });
}
