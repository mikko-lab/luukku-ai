import { NextRequest, NextResponse } from "next/server";
import type { AnalysisResult } from "@/types/analysis";
import { getSession } from "@/src/lib/auth";
import { getReportRatelimit } from "@/src/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // Middleware already 401s unauthenticated requests, but we read the
    // session here to key the rate limiter per user.
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Kirjaudu sisään" }, { status: 401 });
    }

    const rl = getReportRatelimit();
    if (rl) {
      const { success } = await rl.limit(`report:${session.userId}`);
      if (!success) {
        return NextResponse.json(
          { error: "Liian monta pyyntöä, odota hetki" },
          { status: 429 },
        );
      }
    }

    const { result, address, brokerLogo } = await req.json() as {
      result: AnalysisResult;
      address: string;
      brokerLogo?: string;
    };

    // Dynamic import avoids SSR issues
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { createElement } = await import("react");
    const { ReportPDF } = await import("@/src/components/ReportPDF");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = createElement(ReportPDF as any, { result, address, brokerLogo });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any);

    const filename = `luukku-analyysi-${(address || "kohde").replace(/\s+/g, "-").toLowerCase()}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
