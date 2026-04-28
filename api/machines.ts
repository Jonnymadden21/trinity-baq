import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_db";
import { machines } from "../shared/schema";
import { withErrorHandling, methodNotAllowed } from "./_lib/handler";

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const all = await db.select().from(machines);
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).json(all);
});
