/**
 * ChatMessageRecord — the shape domain code reads from a chat-message row.
 * TypeORM `ChatMessage` entity `implements ChatMessageRecord`.
 */
export interface ChatMessageRecord {
  id: number;
  sessionId: string;
  studentId: string;
  threadId: string;
  role: string;
  content: string;
  images: string | null;
  imageDescription: string | null;
  seq: number;
  createdAt: Date;
}
