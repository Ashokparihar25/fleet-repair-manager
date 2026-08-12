import { PDFDocument } from "pdf-lib";

/** Split a multi-page PDF into one single-page PDF buffer per page. */
export async function splitPdfToPageBuffers(bytes: Buffer): Promise<Buffer[]> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  if (total <= 1) return [bytes];

  const pages: Buffer[] = [];
  for (let i = 0; i < total; i++) {
    const doc = await PDFDocument.create();
    const [copied] = await doc.copyPages(src, [i]);
    doc.addPage(copied);
    const out = await doc.save({ useObjectStreams: false });
    pages.push(Buffer.from(out));
  }
  return pages;
}

export async function pdfPageCount(bytes: Buffer): Promise<number> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return src.getPageCount();
}
