import { Router, Request, Response } from "express";
import { z } from "zod";
import { retrieveRelevantChunks } from "../services/retriever";
import { answerQuestion, isDemoMode } from "../services/aiClient";
import {
  createConversation,
  getConversation,
  getHistory,
  addMessage,
  getMessages,
} from "../services/chatService";

const router = Router();

const askSchema = z.object({
  question: z.string().min(1, "Question cannot be empty.").max(2000),
  conversationId: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
});

// POST /api/chat/ask
router.post("/ask", async (req: Request, res: Response) => {
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request." });
  }
  const { question, documentIds } = parsed.data;

  let conversation = parsed.data.conversationId
    ? await getConversation(parsed.data.conversationId, req.userId)
    : undefined;
  if (!conversation) {
    conversation = await createConversation(req.userId);
  }

  try {
    const chunks = await retrieveRelevantChunks(req.userId, question, { documentIds });
    const history = await getHistory(conversation.id);

    const result = await answerQuestion(question, chunks, history);

    await addMessage(conversation.id, "user", question);
    const assistantMessage = await addMessage(
      conversation.id,
      "assistant",
      result.answer,
      result.citations
    );

    res.json({
      conversationId: conversation.id,
      message: {
        id: assistantMessage.id,
        role: "assistant",
        content: result.answer,
        citations: result.citations,
        createdAt: assistantMessage.created_at,
      },
      demoMode: isDemoMode(),
    });
  } catch (err: any) {
    res.status(502).json({
      error: "The AI service is currently unavailable. Please try again in a moment.",
    });
  }
});

// GET /api/chat/:conversationId/messages
router.get("/:conversationId/messages", async (req: Request, res: Response) => {
  const conversation = await getConversation(req.params.conversationId, req.userId);
  if (!conversation) return res.status(404).json({ error: "Conversation not found." });

  const messages = (await getMessages(conversation.id)).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    citations: m.citations ? JSON.parse(m.citations) : [],
    createdAt: m.created_at,
  }));

  res.json({ conversationId: conversation.id, messages });
});

export default router;
