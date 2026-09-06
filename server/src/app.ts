import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { sessionMiddleware } from "./middleware/session";
import documentsRouter from "./routes/documents";
import chatRouter from "./routes/chat";
import { isDemoMode } from "./services/aiClient";
import { initDb } from "./db";

export function createApp() {
  const app = express();

  app.use(
    cors({
      // In production this API is served from the same origin as the
      // client (via Vercel rewrites), so CORS never actually applies there.
      // Reflecting the request origin (rather than hardcoding one) keeps
      // local dev and any preview-deployment URLs working without extra
      // configuration, while still requiring `credentials: true` cookies.
      origin: process.env.CLIENT_ORIGIN || true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // Postgres schema init is idempotent and cached after the first call, so
  // this only does real work once per cold start.
  app.use(async (_req, _res, next) => {
    try {
      await initDb();
      next();
    } catch (err) {
      next(err);
    }
  });

  app.use(sessionMiddleware);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", demoMode: isDemoMode() });
  });

  // Uploaded PDFs are NEVER served from a static/public directory. The only
  // way to read a document's file or text is through these routes, which
  // check req.userId against the document's owner on every request.
  app.use("/api/documents", documentsRouter);
  app.use("/api/chat", chatRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error." });
  });

  return app;
}
