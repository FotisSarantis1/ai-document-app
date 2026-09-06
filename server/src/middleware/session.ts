import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db";

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

const insertUser = db.prepare("INSERT INTO users (id) VALUES (?)");
const findUser = db.prepare("SELECT id FROM users WHERE id = ?");

/**
 * Assigns each browser a stable anonymous user id via a signed-ish httpOnly
 * cookie. There is no login flow in this MVP, but every document, page, and
 * conversation row is scoped to this id so one visitor can never read
 * another visitor's documents.
 */
export function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  let userId = req.cookies?.[COOKIE_NAME];

  if (!userId || !findUser.get(userId)) {
    userId = uuidv4();
    insertUser.run(userId);
    res.cookie(COOKIE_NAME, userId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: ONE_YEAR_MS,
    });
  }

  req.userId = userId;
  next();
}
