import type { ChatMessageRecord } from '../types/chat-message';

export const CHAT_MESSAGE_REPO_PORT = Symbol('ChatMessageRepoPort');

export interface ContinueChatTurnInsert {
  sessionId: string;
  studentId: string;
  threadId: string;
  studentContent: string;
  aiContent: string;
}

export interface DiscussTurnMessage {
  role: 'ai' | 'student';
  text: string;
  images?: string[];
}

export interface DiscussTurnInsert {
  sessionId: string;
  studentId: string;
  threadId: string;
  messages: DiscussTurnMessage[];
  aiReply: string;
  imageDescription?: string | null;
}

export interface TranslateTurnInsert {
  sessionId: string;
  studentId: string;
  threadId: string;
  question: string;
  reply: string;
}

export interface ChatMessageCountRow {
  studentId: string;
  cnt: string;
}

export interface ChatMessageRepoPort {
  /** All messages for a thread, ordered by seq asc. */
  findByThread(sessionId: string, threadId: string): Promise<ChatMessageRecord[]>;
  /** Chat history for a student, optionally narrowed to a single thread. */
  findBySessionAndStudent(
    sessionId: string,
    studentId: string,
    threadId?: string,
  ): Promise<ChatMessageRecord[]>;
  /**
   * Discuss-message count per student (role='user', threadId LIKE 'discuss-%').
   * Returns one row per student that has any discuss messages in the session.
   */
  countDiscussBySessionGroupByStudent(sessionId: string): Promise<ChatMessageCountRow[]>;
  /**
   * Distinct translate-thread count for a student
   * (threadId LIKE 'translate:%').
   */
  countTranslateThreadsBySessionAndStudent(
    sessionId: string,
    studentId: string,
  ): Promise<number>;
  /**
   * Append a continue-chat turn (student msg + AI msg) atomically, using
   * the next contiguous seq numbers.
   */
  appendContinueChatTurn(insert: ContinueChatTurnInsert): Promise<void>;
  /**
   * Append a discuss thread (student message history + final AI reply)
   * atomically. Idempotent on full thread length — only new messages persist.
   */
  appendDiscussThread(insert: DiscussTurnInsert): Promise<void>;
  /**
   * Append a translate follow-up turn (student question + AI reply) atomically.
   */
  appendTranslateTurn(insert: TranslateTurnInsert): Promise<void>;
}
