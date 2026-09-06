import db from "../db";

export interface RetrievedChunk {
  documentId: string;
  documentName: string;
  pageNumber: number;
  text: string;
  score: number;
}

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "and", "or", "but", "if", "then", "than", "so", "to", "of", "in", "on",
  "for", "with", "as", "at", "by", "from", "about", "into", "this", "that",
  "these", "those", "it", "its", "what", "which", "who", "whom", "does",
  "do", "did", "has", "have", "had", "can", "could", "should", "would",
  "will", "shall", "i", "you", "he", "she", "they", "we", "my", "your",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Keyword/term-frequency retrieval over stored page text.
 *
 * This intentionally uses simple scoring instead of a vector database so the
 * MVP has zero extra infrastructure. Each `pages` row already carries a
 * spare `embedding` column and stable (documentId, pageNumber) identity, so
 * swapping this function's body for a real embedding similarity search
 * later doesn't require touching callers (chat route) or the schema.
 */
export function retrieveRelevantChunks(
  userId: string,
  query: string,
  options: { documentIds?: string[]; topK?: number } = {}
): RetrievedChunk[] {
  const { documentIds, topK = 6 } = options;

  const terms = Array.from(new Set(tokenize(query)));
  if (terms.length === 0) return [];

  let sql = `
    SELECT p.page_number as pageNumber, p.text as text,
           d.id as documentId, d.original_name as documentName
    FROM pages p
    JOIN documents d ON d.id = p.document_id
    WHERE d.user_id = ? AND d.status = 'ready'
  `;
  const params: any[] = [userId];

  if (documentIds && documentIds.length > 0) {
    sql += ` AND d.id IN (${documentIds.map(() => "?").join(",")})`;
    params.push(...documentIds);
  }

  const rows = db.prepare(sql).all(...params) as {
    pageNumber: number;
    text: string;
    documentId: string;
    documentName: string;
  }[];

  const phrase = query.toLowerCase().trim();

  const scored: RetrievedChunk[] = rows.map((row) => {
    const lowerText = row.text.toLowerCase();
    let score = 0;

    for (const term of terms) {
      const occurrences = lowerText.split(term).length - 1;
      score += occurrences;
    }

    if (phrase.length > 3 && lowerText.includes(phrase)) {
      score += 5;
    }

    return {
      documentId: row.documentId,
      documentName: row.documentName,
      pageNumber: row.pageNumber,
      text: row.text,
      score,
    };
  });

  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
