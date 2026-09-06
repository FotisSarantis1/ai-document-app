import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { ConversationRecord, MessageRecord, Citation } from "../types";
import { ChatTurn } from "./aiClient";

export function createConversation(userId: string): ConversationRecord {
  const id = uuidv4();
  db.prepare("INSERT INTO conversations (id, user_id) VALUES (?, ?)").run(id, userId);
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as ConversationRecord;
}

export function getConversation(id: string, userId: string): ConversationRecord | undefined {
  return db
    .prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?")
    .get(id, userId) as ConversationRecord | undefined;
}

export function getHistory(conversationId: string, limit = 10): ChatTurn[] {
  const rows = db
    .prepare(
      `SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?`
    )
    .all(conversationId, limit) as { role: "user" | "assistant"; content: string }[];
  return rows;
}

export function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  citations: Citation[] = []
): MessageRecord {
  const id = uuidv4();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, citations) VALUES (?, ?, ?, ?, ?)`
  ).run(id, conversationId, role, content, JSON.stringify(citations));
  return db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as MessageRecord;
}

export function getMessages(conversationId: string): MessageRecord[] {
  return db
    .prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`)
    .all(conversationId) as MessageRecord[];
}
