export type BrochureFile = {
  file: string;
  label: "Brochure" | "Spec Sheet";
};

const RAW: Record<string, string[]> = {
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
};

export const BROCHURE_MAP: Record<string, string[]> = RAW;

export function brochuresForSlug(slug: string): BrochureFile[] {
  const files = RAW[slug];
  if (!files) return [];
  return files.map((file) => ({
    file,
    label: file.includes("spec") ? "Spec Sheet" : "Brochure",
  }));
}

export function brochureUrl(file: string): string {
  return `/brochures/${file}`;
}
