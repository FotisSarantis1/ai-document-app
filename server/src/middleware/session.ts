import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db";

const COOKIE_NAME = "adp_uid";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

/**
 * Assigns each browser a stable anonymous user id via a signed-ish httpOnly
 * cookie. There is no login flow in this MVP, but every document, page, and
 * conversation row is scoped to this id so one visitor can never read
 * another visitor's documents.
 */
export async function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    let userId = req.cookies?.[COOKIE_NAME];

    if (userId) {
      const existing = await query("SELECT id FROM users WHERE id = $1", [userId]);
      if (existing.rows.length === 0) userId = undefined;
    }

    if (!userId) {
      userId = uuidv4();
      await query("INSERT INTO users (id) VALUES ($1)", [userId]);
      res.cookie(COOKIE_NAME, userId, {
        httpOnly: true,
        sameSite: "lax",
        secure: !!process.env.VERCEL,
        maxAge: ONE_YEAR_MS,
      });
    }

    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}
