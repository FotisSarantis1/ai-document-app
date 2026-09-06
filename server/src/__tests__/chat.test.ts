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

async function uploadReadyDoc(agent: any, filename: string, pages: string[]) {
  const pdf = await makeTestPdf(pages);
  const uploadRes = await agent
    .post("/api/documents/upload")
    .attach("files", pdf, { filename, contentType: "application/pdf" });
  const docId = uploadRes.body.results[0].document.id;
  await waitUntilReady(agent, docId);
  return docId;
}

describe("POST /api/chat/ask", () => {
  it("answers a question using retrieved content and cites the source document + page", async () => {
    const agent = request.agent(app);
    await uploadReadyDoc(agent, "policy.pdf", [
      "Introduction page with no relevant policy details.",
      "Cancellation policy: customers may cancel within thirty days of purchase for a full refund.",
    ]);

    const res = await agent.post("/api/chat/ask").send({ question: "What is the cancellation policy?" });

    expect(res.status).toBe(200);
    expect(res.body.message.content).toMatch(/cancel/i);
    expect(res.body.message.citations.length).toBeGreaterThan(0);
    expect(res.body.message.citations[0]).toMatchObject({
      documentName: "policy.pdf",
      pageNumber: 2,
    });
    expect(res.body.conversationId).toBeDefined();
  });

  it('says it could not find the answer when no document supports it', async () => {
    const agent = request.agent(app);
    await uploadReadyDoc(agent, "unrelated.pdf", ["This document is about gardening tips and soil pH levels."]);

    const res = await agent.post("/api/chat/ask").send({ question: "What is the price of the enterprise plan?" });

    expect(res.status).toBe(200);
    expect(res.body.message.content).toBe("I couldn't find this information in the uploaded documents.");
    expect(res.body.message.citations).toEqual([]);
  });

  it("returns the not-found message when there are no documents at all (empty state)", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/api/chat/ask").send({ question: "What are the requirements?" });

    expect(res.status).toBe(200);
    expect(res.body.message.content).toBe("I couldn't find this information in the uploaded documents.");
  });

  it("maintains conversation context across follow-up questions", async () => {
    const agent = request.agent(app);
    await uploadReadyDoc(agent, "handbook.pdf", [
      "Employees accrue twenty vacation days per year and must request time off two weeks in advance.",
    ]);

    const first = await agent.post("/api/chat/ask").send({ question: "How many vacation days do employees get?" });
    expect(first.status).toBe(200);
    const conversationId = first.body.conversationId;

    const followUp = await agent
      .post("/api/chat/ask")
      .send({ question: "How far in advance must it be requested?", conversationId });

    expect(followUp.status).toBe(200);
    expect(followUp.body.conversationId).toBe(conversationId);

    const historyRes = await agent.get(`/api/chat/${conversationId}/messages`);
    expect(historyRes.status).toBe(200);
    // 2 user questions + 2 assistant answers
    expect(historyRes.body.messages).toHaveLength(4);
    expect(historyRes.body.messages[0].role).toBe("user");
    expect(historyRes.body.messages[1].role).toBe("assistant");
  });

  it("rejects an empty question with a 400 error", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/api/chat/ask").send({ question: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 404 for a conversation that does not belong to the session", async () => {
    const agentA = request.agent(app);
    const agentB = request.agent(app);

    await uploadReadyDoc(agentA, "doc.pdf", ["Some content about requirements."]);
    const ask = await agentA.post("/api/chat/ask").send({ question: "What are the requirements?" });
    const conversationId = ask.body.conversationId;

    const res = await agentB.get(`/api/chat/${conversationId}/messages`);
    expect(res.status).toBe(404);
  });
});
