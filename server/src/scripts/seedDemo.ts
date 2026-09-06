import dotenv from "dotenv";
dotenv.config();

import { initDb, query } from "../db";
import { loadDemoDocuments } from "../services/demoService";

const DEMO_USER_ID = "demo-cli-user";

/**
 * Standalone CLI entry point (`npm run seed:demo`) for generating and
 * ingesting the sample PDFs without starting the HTTP server or a browser.
 * The same documents are also loadable from the running app via the
 * "Load sample documents" button, which calls POST /api/documents/demo
 * for the current browser session instead of this fixed CLI user.
 */
async function main() {
  await initDb();
  await query("INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [DEMO_USER_ID]);

  console.log(`Generating and processing demo documents for user "${DEMO_USER_ID}"...`);
  const docs = await loadDemoDocuments(DEMO_USER_ID);

  for (const doc of docs) {
    console.log(`  - ${doc.original_name}: ${doc.status} (${doc.page_count} pages)`);
  }

  console.log("\nDone. Start the server with `npm run dev` and use this cookie to query as the demo user:");
  console.log(`  adp_uid=${DEMO_USER_ID}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
