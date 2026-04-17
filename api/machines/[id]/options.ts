import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../_db.js";
import { optionCategories, options } from "../../../shared/schema.js";
import { eq, asc } from "drizzle-orm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  const machineId = Number(id);
  if (isNaN(machineId)) {
    return res.status(400).json({ error: "Invalid machine ID" });
  }

  try {
    const categories = await db
      .select()
      .from(optionCategories)
      .where(eq(optionCategories.machineId, machineId))
      .orderBy(asc(optionCategories.sortOrder));

    const grouped = await Promise.all(
      categories.map(async (cat) => ({
        ...cat,
        options: await db.select().from(options).where(eq(options.categoryId, cat.id)),
      }))
    );

    return res.status(200).json(grouped);
  } catch (error: any) {
    console.error("Error fetching options:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
