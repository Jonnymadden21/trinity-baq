import type { Quote } from "@shared/schema";

type SelectedOption = { id: number; name: string; partNumber: string | null; price: number; isStandard: boolean; category: string };

export type ExportQuoteArgs = {
  quote: Quote;
  options: SelectedOption[];
  financing: any;
  roi: any;
};

const BROCHURE_MAP: Record<string, string[]> = {
  "ax1-12": ["ax1-spec.pdf"], "ax1-18": ["ax1-spec.pdf"],
  "ax2-16": ["ax2-brochure.pdf", "ax2-spec.pdf"], "ax2-24": ["ax2-brochure.pdf", "ax2-spec.pdf"],
  "ax2-16-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"], "ax2-24-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"],
  "ax4-12": ["ax4-spec.pdf"], "ax4-12-hd": ["ax4-spec.pdf"],
  "ax5-20": ["ax5-brochure.pdf", "ax5-spec.pdf"], "ax5-20-hd": ["ax5-hd-brochure.pdf"],
};

export async function exportQuotePdf({ quote }: ExportQuoteArgs) {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const el = document.querySelector(".prop") as HTMLElement;
  if (!el) { console.error("Proposal element not found"); return; }

  // Hide no-print elements
  const hidden = el.querySelectorAll(".no-print");
  hidden.forEach(h => (h as HTMLElement).style.display = "none");

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  // Restore hidden elements
  hidden.forEach(h => (h as HTMLElement).style.display = "");

  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  // Letter size in points: 612 x 792
  const pageW = 612;
  const pageH = 792;
  const imgW = pageW;
  const imgH = (canvas.height / canvas.width) * imgW;
  const totalPages = Math.ceil(imgH / pageH);

  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) doc.addPage();
    doc.addImage(imgData, "JPEG", 0, -(i * pageH), imgW, imgH);
  }

  // Merge brochures
  const machineSlug = quote.machineName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
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
        const bytes = await fetch(`/brochures/${file}`).then(r => r.arrayBuffer());
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
