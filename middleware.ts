import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getJwtSecret } from "@/src/lib/jwtSecret";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("session")?.value;

  if (!token) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await jwtVerify(token, getJwtSecret());
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}

export const config = {
  matcher: [
    "/analyysit",
    "/kohteet",
    "/raportit",
    "/asetukset",
    "/ohjeet",
    "/api/analyze",
    "/api/report",
    "/api/analysis/:id",
  ],
};
