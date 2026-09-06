// Vercel serverless function entry point. Every request to /api/* is
// rewritten here (see vercel.json), and Express's app object is itself a
// valid (req, res) request handler, so exporting it directly is all that's
// needed - no extra adapter/shim required.
import { createApp } from "../server/src/app";

const app = createApp();

export default app;
