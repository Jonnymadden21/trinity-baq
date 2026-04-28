import { Resend } from "resend";
import { env } from "./env";

export interface QuoteEmailInput {
  quoteNumber: string;
  machineName: string;
  totalPrice: string;
  customerName: string;
  customerEmail: string;
  customerCompany: string | null;
  customerPhone: string | null;
  summaryUrl: string;
}

function fmtMoney(s: string): string {
  const [whole, frac = "00"] = s.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${frac}`;
}

export function renderQuoteEmail(q: QuoteEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const total = fmtMoney(q.totalPrice);
  const subject = `New Trinity quote — ${q.machineName} — ${total}`;
  const company = q.customerCompany ? `<br>${q.customerCompany}` : "";
  const phone = q.customerPhone ? `<br>${q.customerPhone}` : "";
  const html = `
    <h2>New quote: ${q.quoteNumber}</h2>
    <p><strong>${q.machineName}</strong> — ${total}</p>
    <h3>Customer</h3>
    <p>${q.customerName}<br>${q.customerEmail}${company}${phone}</p>
    <p><a href="${q.summaryUrl}">View quote summary</a></p>
  `.trim();
  const text =
    `New quote: ${q.quoteNumber}\n` +
    `${q.machineName} — ${total}\n\n` +
    `${q.customerName}\n${q.customerEmail}\n` +
    `${q.customerCompany ?? ""}\n${q.customerPhone ?? ""}\n\n` +
    `${q.summaryUrl}`;
  return { subject, html, text };
}

let cachedResend: Resend | null | undefined;
function getResend(): Resend | null {
  if (cachedResend !== undefined) return cachedResend;
  if (!env.RESEND_API_KEY) {
    cachedResend = null;
    return null;
  }
  cachedResend = new Resend(env.RESEND_API_KEY);
  return cachedResend;
}

export async function sendQuoteEmail(q: QuoteEmailInput): Promise<void> {
  const client = getResend();
  if (!client || !env.LEAD_NOTIFICATION_TO) {
    console.warn("Resend not configured; skipping lead notification");
    return;
  }
  const { subject, html, text } = renderQuoteEmail(q);
  const recipients = env.LEAD_NOTIFICATION_TO.split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const result = await client.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: recipients,
      subject,
      html,
      text,
    });
    if (result.error) console.error("Resend send error:", result.error);
  } catch (err) {
    console.error("Resend send threw:", err);
  }
}
