import type { Quote } from "@shared/schema";

type SelectedOption = {
  id: number;
  name: string;
  partNumber: string | null;
  price: number;
  isStandard: boolean;
  category: string;
};

export type ExportQuoteArgs = {
  quote: Quote;
  options: SelectedOption[];
  financing: any;
  roi: any;
};

const BROCHURE_MAP: Record<string, string[]> = {
  "ax1-12": ["ax1-spec.pdf"],
  "ax1-18": ["ax1-spec.pdf"],
  "ax2-16": ["ax2-brochure.pdf", "ax2-spec.pdf"],
  "ax2-24": ["ax2-brochure.pdf", "ax2-spec.pdf"],
  "ax2-16-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"],
  "ax2-24-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"],
  "ax4-12": ["ax4-spec.pdf"],
  "ax4-12-hd": ["ax4-spec.pdf"],
  "ax5-20": ["ax5-brochure.pdf", "ax5-spec.pdf"],
  "ax5-20-hd": ["ax5-hd-brochure.pdf"],
  "ai-part-loader": ["ai-part-loader.pdf"],
};

/**
 * High-fidelity export: render each `.page` element to its own canvas and add
 * it as a full letter-size page in the PDF. This prevents mid-row content
 * splits across printed pages.
 */
export async function exportQuotePdf({ quote }: ExportQuoteArgs) {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const container = document.querySelector(".prop") as HTMLElement;
  if (!container) {
    console.error("Proposal container not found");
    return;
  }
  const pages = container.querySelectorAll<HTMLElement>(".page");
  if (pages.length === 0) {
    console.error("No .page elements found in proposal");
    return;
  }

  // Hide anything marked .np (no-print) while we snapshot
  const noPrint = document.querySelectorAll<HTMLElement>(".np");
  const prevDisplay: string[] = [];
  noPrint.forEach((el, i) => {
    prevDisplay[i] = el.style.display;
    el.style.display = "none";
  });

  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const pageW = 612; // 8.5in * 72
  const pageH = 792; // 11in * 72

  try {
    for (let i = 0; i < pages.length; i++) {
      const el = pages[i];
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: el.scrollWidth,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      // Scale image to fit page while preserving aspect ratio.
      const imgRatio = canvas.width / canvas.height;
      const pageRatio = pageW / pageH;
      let w = pageW;
      let h = pageH;
      if (imgRatio > pageRatio) {
        // image wider than page — fit to width
        h = pageW / imgRatio;
      } else {
        // image taller than page — fit to height
        w = pageH * imgRatio;
      }
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;

      if (i > 0) doc.addPage();
      doc.addImage(imgData, "JPEG", x, y, w, h, undefined, "FAST");
    }
  } finally {
    noPrint.forEach((el, i) => {
      el.style.display = prevDisplay[i] ?? "";
    });
  }

  // Merge brochures at the end if available
  const machineSlug = quote.machineName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const brochureFiles = BROCHURE_MAP[machineSlug];

  if (brochureFiles && brochureFiles.length > 0) {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const quoteBytes = doc.output("arraybuffer");
      const merged = await PDFDocument.create();

      const quotePdf = await PDFDocument.load(quoteBytes);
      const qPages = await merged.copyPages(quotePdf, quotePdf.getPageIndices());
      for (const p of qPages) merged.addPage(p);

      for (const file of brochureFiles) {
        const bytes = await fetch(`/brochures/${file}`).then((r) =>
          r.arrayBuffer(),
        );
        const bPdf = await PDFDocument.load(bytes);
        const bPages = await merged.copyPages(bPdf, bPdf.getPageIndices());
        for (const p of bPages) merged.addPage(p);
      }

      const mergedBytes = await merged.save();
      const blob = new Blob([mergedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Trinity-Quote-${quote.quoteNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    } catch (err) {
      console.warn("Brochure merge failed, saving quote only:", err);
    }
  }

  doc.save(`Trinity-Quote-${quote.quoteNumber}.pdf`);
}
