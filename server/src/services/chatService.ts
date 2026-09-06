import { v4 as uuidv4 } from "uuid";
import { query } from "../db";
import { ConversationRecord, MessageRecord, Citation } from "../types";
import { ChatTurn } from "./aiClient";

export async function createConversation(userId: string): Promise<ConversationRecord> {
  const id = uuidv4();
  const res = await query<ConversationRecord>(
    `INSERT INTO conversations (id, user_id) VALUES ($1, $2) RETURNING *`,
    [id, userId]
  );
  return res.rows[0];
}

export async function getConversation(
  id: string,
  userId: string
): Promise<ConversationRecord | undefined> {
  const res = await query<ConversationRecord>(
    `SELECT * FROM conversations WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return res.rows[0];
}

export async function getHistory(conversationId: string, limit = 10): Promise<ChatTurn[]> {
  const res = await query<{ role: "user" | "assistant"; content: string }>(
    `SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT $2`,
    [conversationId, limit]
  );
  return res.rows;
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  citations: Citation[] = []
): Promise<MessageRecord> {
  const id = uuidv4();
  const res = await query<MessageRecord>(
    `INSERT INTO messages (id, conversation_id, role, content, citations)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, conversationId, role, content, JSON.stringify(citations)]
  );
  return res.rows[0];
}

export async function getMessages(conversationId: string): Promise<MessageRecord[]> {
  const res = await query<MessageRecord>(
    `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId]
  );
  return res.rows;
}
