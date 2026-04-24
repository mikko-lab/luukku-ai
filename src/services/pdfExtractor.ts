import { log, logError } from "@/src/utils/logger";

const SERVICE = "pdfExtractor";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  log(SERVICE, `Parsing PDF (${Math.round(buffer.length / 1024)} KB)...`);

  const t = Date.now();
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);

  const text = data.text ?? "";
  const charCount = text.length;
  const elapsed = Date.now() - t;

  if (charCount < 50) {
    const msg = "Extracted text too short — PDF may be scanned/image-only";
    logError(SERVICE, msg);
    throw new Error(msg);
  }

  log(SERVICE, `Extracted ${charCount} chars, ${data.numpages} page(s) in ${elapsed}ms`);
  return text;
}
