import type { AnalysisResult } from "@/types/analysis";

export interface ReportRenderInput {
  result: AnalysisResult;
  address: string;
  brokerLogo?: string;
}

export async function renderReportPdf(
  input: ReportRenderInput,
): Promise<Uint8Array> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { createElement } = await import("react");
  const { ReportPDF } = await import("@/src/components/ReportPDF");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(ReportPDF as any, input);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  return new Uint8Array(buffer);
}

export function buildReportAddress(result: AnalysisResult): string {
  const year = result.extracted.building_year ?? "";
  const size = result.extracted.apartment_size_m2;
  if (!size) return "Kohde";
  return `${year} · ${size} m²`;
}
