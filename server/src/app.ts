import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { sessionMiddleware } from "./middleware/session";
import documentsRouter from "./routes/documents";
import chatRouter from "./routes/chat";
import { isDemoMode } from "./services/aiClient";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
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
