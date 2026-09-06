import request from "supertest";
import { createApp } from "../app";
import { makeTestPdf } from "./helpers/makePdf";

const app = createApp();

async function waitUntilReady(agent: any, docId: string, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await agent.get(`/api/documents/${docId}`);
    if (res.body.document.status !== "processing") return res.body.document;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Timed out waiting for document to finish processing");
}

describe("POST /api/documents/upload", () => {
  it("uploads a valid multi-page PDF and stores document + page records", async () => {
    const agent = request.agent(app);
    const pdf = await makeTestPdf(["Page one content about requirements.", "Page two content about deadlines."]);

    const uploadRes = await agent
      .post("/api/documents/upload")
      .attach("files", pdf, { filename: "handbook.pdf", contentType: "application/pdf" });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.results).toHaveLength(1);
    const created = uploadRes.body.results[0].document;
    expect(created.original_name).toBe("handbook.pdf");
    expect(["processing", "ready"]).toContain(created.status);

    const doc = await waitUntilReady(agent, created.id);
    expect(doc.status).toBe("ready");
    expect(doc.page_count).toBe(2);

    const pagesRes = await agent.get(`/api/documents/${created.id}/pages`);
    expect(pagesRes.status).toBe(200);
    expect(pagesRes.body.pages).toHaveLength(2);
    expect(pagesRes.body.pages[0].page_number).toBe(1);
    expect(pagesRes.body.pages[0].text).toContain("requirements");
    expect(pagesRes.body.pages[1].page_number).toBe(2);
    expect(pagesRes.body.pages[1].text).toContain("deadlines");
  });

  it("appears in the document list after upload", async () => {
    const agent = request.agent(app);
    const pdf = await makeTestPdf(["Some content."]);

    const uploadRes = await agent
      .post("/api/documents/upload")
      .attach("files", pdf, { filename: "one-pager.pdf", contentType: "application/pdf" });
    const docId = uploadRes.body.results[0].document.id;
    await waitUntilReady(agent, docId);

    const listRes = await agent.get("/api/documents");
    expect(listRes.status).toBe(200);
    expect(listRes.body.documents.map((d: any) => d.id)).toContain(docId);
  });

  it("rejects non-PDF file types with a clear message", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/documents/upload")
      .attach("files", Buffer.from("just some text"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pdf/i);
  });

  it("rejects a file with a .pdf extension whose content is not really a PDF", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/documents/upload")
      .attach("files", Buffer.from("not actually a pdf file"), {
        filename: "fake.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    expect(res.body.results[0].error).toMatch(/not a valid pdf/i);
  });

  it("returns an error when no file is attached", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/api/documents/upload");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("isolates documents between different browser sessions (users)", async () => {
    const agentA = request.agent(app);
    const agentB = request.agent(app);

    const pdf = await makeTestPdf(["User A's private document."]);
    const uploadRes = await agentA
      .post("/api/documents/upload")
      .attach("files", pdf, { filename: "private.pdf", contentType: "application/pdf" });
    const docId = uploadRes.body.results[0].document.id;
    await waitUntilReady(agentA, docId);

    const listB = await agentB.get("/api/documents");
    expect(listB.body.documents).toHaveLength(0);

    const getB = await agentB.get(`/api/documents/${docId}`);
    expect(getB.status).toBe(404);
  });
});

describe("DELETE /api/documents/:id", () => {
  it("deletes a document and its file", async () => {
    const agent = request.agent(app);
    const pdf = await makeTestPdf(["Delete me."]);
    const uploadRes = await agent
      .post("/api/documents/upload")
      .attach("files", pdf, { filename: "delete-me.pdf", contentType: "application/pdf" });
    const docId = uploadRes.body.results[0].document.id;
    await waitUntilReady(agent, docId);

    const del = await agent.delete(`/api/documents/${docId}`);
    expect(del.status).toBe(204);

    const get = await agent.get(`/api/documents/${docId}`);
    expect(get.status).toBe(404);
  });

  it("returns 404 when deleting a document that does not exist", async () => {
    const agent = request.agent(app);
    const res = await agent.delete("/api/documents/does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/documents (empty state)", () => {
  it("returns an empty list for a brand new session", async () => {
    const agent = request.agent(app);
    const res = await agent.get("/api/documents");
    expect(res.status).toBe(200);
    expect(res.body.documents).toEqual([]);
  });
});
