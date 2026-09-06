/**
 * Mirrors what the real client does after an upload: fire a request to
 * POST /:id/process (processing is no longer started by the server as a
 * background side effect of /upload - see routes/documents.ts for why),
 * then confirm the document actually left "processing".
 */
export async function processAndWait(agent: any, docId: string, timeoutMs = 5000) {
  await agent.post(`/api/documents/${docId}/process`);

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await agent.get(`/api/documents/${docId}`);
    if (res.body.document.status !== "processing") return res.body.document;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Timed out waiting for document to finish processing");
}
