import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public clientMessage: string,
  ) {
    super(clientMessage);
  }
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void;

export function withErrorHandling(handler: Handler): Handler {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.clientMessage });
        return;
      }
      if (err instanceof ZodError) {
        console.error("ZodError:", err.flatten());
        res.status(400).json({ error: "Invalid input" });
        return;
      }
      console.error("Unhandled API error:", err);
      res.status(500).json({ error: "Server error" });
    }
  };
}

export function methodNotAllowed(res: VercelResponse, allow: string[]): void {
  res.setHeader("Allow", allow.join(", "));
  res.status(405).json({ error: "Method not allowed" });
}
