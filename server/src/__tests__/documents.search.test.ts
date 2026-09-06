import request from "supertest";
import { createApp } from "../app";
import { makeTestPdf } from "./helpers/makePdf";
import { processAndWait } from "./helpers/testFlow";

const app = createApp();

describe("GET /api/documents?search=", () => {
  it("filters documents by name", async () => {
    const agent = request.agent(app);
    const pdf1 = await makeTestPdf(["content"]);
    const pdf2 = await makeTestPdf(["content"]);

    const r1 = await agent
      .post("/api/documents/upload")
      .attach("files", pdf1, { filename: "quarterly-report.pdf", contentType: "application/pdf" });
    const r2 = await agent
      .post("/api/documents/upload")
      .attach("files", pdf2, { filename: "employee-handbook.pdf", contentType: "application/pdf" });

    await processAndWait(agent, r1.body.results[0].document.id);
    await processAndWait(agent, r2.body.results[0].document.id);

    const res = await agent.get("/api/documents").query({ search: "handbook" });
    expect(res.status).toBe(200);
    expect(res.body.documents).toHaveLength(1);
    expect(res.body.documents[0].original_name).toBe("employee-handbook.pdf");
  });
});

describe("POST /api/documents/demo", () => {
  it("loads the bundled sample documents for the current session, flagged as demo", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/api/documents/demo");

    expect(res.status).toBe(201);
    expect(res.body.documents.length).toBeGreaterThanOrEqual(3);
    for (const doc of res.body.documents) {
      expect(doc.is_demo).toBe(true);
      expect(doc.status).toBe("ready");
      expect(doc.page_count).toBeGreaterThan(0);
    }

    const list = await agent.get("/api/documents");
    expect(list.body.documents.length).toBe(res.body.documents.length);
  });
});
