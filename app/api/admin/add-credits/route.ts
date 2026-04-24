import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (!key || key !== process.env.ADMIN_KEY) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { userId, amount } = await req.json();
  if (!userId || typeof amount !== "number") {
    return NextResponse.json({ error: "userId ja amount vaaditaan" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id: userId },
    data: { credits_remaining: { increment: amount } },
  });

  return NextResponse.json({ ok: true, credits_remaining: user.credits_remaining });
}
