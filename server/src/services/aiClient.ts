import Anthropic from "@anthropic-ai/sdk";
import { RetrievedChunk } from "./retriever";
import { Citation } from "../types";

const NOT_FOUND_MESSAGE =
  "I couldn't find this information in the uploaded documents.";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AnswerResult {
  answer: string;
  citations: Citation[];
  usedMock: boolean;
}

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.AI_MODEL || "claude-sonnet-5";
const client = apiKey ? new Anthropic({ apiKey }) : null;

function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}: ${c.documentName} — Page ${c.pageNumber}]\n${c.text}`
    )
    .join("\n\n---\n\n");
}

function chunksToCitations(chunks: RetrievedChunk[]): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const c of chunks) {
    const key = `${c.documentId}:${c.pageNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({
      documentId: c.documentId,
      documentName: c.documentName,
      pageNumber: c.pageNumber,
      snippet: c.text.slice(0, 240),
    });
  }
  return citations;
}

/**
 * Deterministic fallback used when ANTHROPIC_API_KEY is not configured
 * (demo mode). It never invents facts: it only ever echoes back the
 * highest-scoring retrieved passages, or the "not found" message when
 * retrieval came back empty. This keeps the full upload -> ask -> cite
 * flow testable with zero external services.
 */
function mockAnswer(question: string, chunks: RetrievedChunk[]): AnswerResult {
  if (chunks.length === 0) {
    return { answer: NOT_FOUND_MESSAGE, citations: [], usedMock: true };
  }

  const top = chunks.slice(0, 3);
  const excerpts = top
    .map((c) => `"${c.text.slice(0, 300).trim()}${c.text.length > 300 ? "…" : ""}"`)
    .join("\n\n");

  const answer =
    `[Demo mode — no AI API key configured, showing the most relevant excerpts instead of a generated answer]\n\n` +
    `Based on the uploaded documents, here is the relevant content for "${question}":\n\n${excerpts}`;

  return { answer, citations: chunksToCitations(top), usedMock: true };
}

const SYSTEM_PROMPT = `You are "Ask your documents", an assistant that answers questions strictly using the provided document excerpts.

Rules you must always follow:
1. Only use information contained in the provided context. Never use outside knowledge and never invent facts, numbers, or dates.
2. If the context does not contain the answer, reply with exactly: "I couldn't find this information in the uploaded documents." Do not guess.
3. When you do answer, cite every source you used inline in the form (Source: <document name> — Page <page number>). Cite multiple sources when multiple pages support the answer.
4. Be concise and direct. Use bullet points for lists (e.g. requirements, deadlines, obligations).`;

export async function answerQuestion(
  question: string,
  chunks: RetrievedChunk[],
  history: ChatTurn[] = []
): Promise<AnswerResult> {
  if (!client) {
    return mockAnswer(question, chunks);
  }

  if (chunks.length === 0) {
    return { answer: NOT_FOUND_MESSAGE, citations: [], usedMock: false };
  }

  const context = buildContextBlock(chunks);

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    {
      role: "user" as const,
      content: `Document excerpts:\n\n${context}\n\nQuestion: ${question}`,
    },
  ];

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const answer = textBlock && "text" in textBlock ? textBlock.text : NOT_FOUND_MESSAGE;

  return {
    answer,
    citations: chunksToCitations(chunks),
    usedMock: false,
  };
}

export async function summarizeDocument(
  documentName: string,
  pages: { pageNumber: number; text: string }[]
): Promise<string> {
  const fullText = pages
    .map((p) => `[Page ${p.pageNumber}]\n${p.text}`)
    .join("\n\n")
    .slice(0, 60000); // keep prompt bounded for very large documents

  if (!fullText.trim()) {
    return "This document has no extractable text, so no summary could be generated.";
  }

  if (!client) {
    const preview = fullText.slice(0, 500).replace(/\s+/g, " ").trim();
    return (
      `[Demo mode — no AI API key configured]\n\n` +
      `Short summary: "${documentName}" contains ${pages.length} page(s). Preview of content: ${preview}...\n\n` +
      `Key points: Configure ANTHROPIC_API_KEY to generate a real AI summary with key points, dates, obligations, and named entities.`
    );
  }

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system:
      "You summarize documents strictly from their provided text. Never invent information not present in the text.",
    messages: [
      {
        role: "user",
        content: `Summarize the document "${documentName}" using only the text below. Respond in this exact structure with markdown headings:\n\n## Short Summary\n(2-4 sentences)\n\n## Key Points\n(bullet list)\n\n## Important Dates\n(bullet list, or "None found" )\n\n## Obligations\n(bullet list, or "None found")\n\n## Named Entities\n(people, organizations, or "None found")\n\nWhen listing a point derived from a specific page, mention the page number in parentheses.\n\nDocument text:\n\n${fullText}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text : "Summary unavailable.";
}

export function isDemoMode(): boolean {
  return !client;
}
