import { NextRequest, NextResponse } from "next/server";
import type { AnalysisResult } from "@/types/analysis";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { result, address } = await req.json() as { result: AnalysisResult; address: string };

    // Dynamic import avoids SSR issues
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { createElement } = await import("react");
    const { ReportPDF } = await import("@/src/components/ReportPDF");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = createElement(ReportPDF as any, { result, address });
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
