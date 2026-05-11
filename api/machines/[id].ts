import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../_db.js";
import { machines } from "../../shared/schema.js";
import { withErrorHandling, methodNotAllowed, HttpError } from "../_lib/handler.js";

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const { id } = req.query;
  const slug = typeof id === "string" ? id : undefined;
  if (!slug || !SLUG_RE.test(slug)) throw new HttpError(400, "Invalid slug");
  const [m] = await db.select().from(machines).where(eq(machines.slug, slug)).limit(1);
  if (!m) throw new HttpError(404, "Not found");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).json(m);
});
