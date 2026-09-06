import request from "supertest";

jest.mock("../services/aiClient", () => {
  const actual = jest.requireActual("../services/aiClient");
  return {
    ...actual,
    answerQuestion: jest.fn().mockRejectedValue(new Error("simulated AI provider outage")),
  };
});

import { createApp } from "../app";
import { makeTestPdf } from "./helpers/makePdf";

const app = createApp();

describe("POST /api/chat/ask - API error handling", () => {
  it("returns a 502 with a clear error message when the AI service fails", async () => {
    const agent = request.agent(app);
    const pdf = await makeTestPdf(["Some content about deadlines and requirements."]);
    const uploadRes = await agent
      .post("/api/documents/upload")
      .attach("files", pdf, { filename: "doc.pdf", contentType: "application/pdf" });
    const docId = uploadRes.body.results[0].document.id;

    // give processing a moment
    for (let i = 0; i < 50; i++) {
      const check = await agent.get(`/api/documents/${docId}`);
      if (check.body.document.status !== "processing") break;
      await new Promise((r) => setTimeout(r, 50));
    }

    const res = await agent.post("/api/chat/ask").send({ question: "What are the deadlines?" });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/unavailable/i);
  });
});
