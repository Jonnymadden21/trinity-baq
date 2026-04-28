import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../_db";
import { machines, optionCategories, options } from "../../../shared/schema";
import { withErrorHandling, methodNotAllowed, HttpError } from "../../_lib/handler";

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const { id } = req.query;
  const slug = typeof id === "string" ? id : undefined;
  if (!slug || !SLUG_RE.test(slug)) throw new HttpError(400, "Invalid slug");

  const [machine] = await db.select().from(machines).where(eq(machines.slug, slug)).limit(1);
  if (!machine) throw new HttpError(404, "Not found");

  const categories = await db
    .select()
    .from(optionCategories)
    .where(eq(optionCategories.machineId, machine.id))
    .orderBy(optionCategories.sortOrder);

  if (categories.length === 0) {
    res.status(200).json([]);
    return;
  }

  const allOpts = await db
    .select()
    .from(options)
    .where(
      inArray(
        options.categoryId,
        categories.map((c) => c.id),
      ),
    )
    .orderBy(options.id);

  const grouped = categories.map((c) => ({
    ...c,
    options: allOpts.filter((o) => o.categoryId === c.id),
  }));

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).json(grouped);
});
