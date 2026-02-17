/**
 * Turn Entity
 *
 * Tracks dialogue turns (user input + assistant response) with per-turn analytics.
 * A turn represents one exchange: user sends a message, assistant responds.
 *
 * TODO: This is scaffolded infrastructure for future per-turn analytics.
 * Current status:
 * - Entity and migration created ✅
 * - Frontend hook (useTurns) created ✅
 * - Backend endpoint NOT yet implemented ❌
 * - Turn creation NOT yet wired up in completion flow ❌
 *
 * To complete:
 * 1. Add GET /api/v1/conversations/:id/turns endpoint in ConversationsController
 * 2. Wire up Turn creation in CompletionOrchestrationService
 * 3. Track turnNumber, userMessageId, assistantMessageId, tokens, duration
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('turns')
@Index('IDX_turns_session_turn', ['sessionId', 'turnNumber'])
export class Turn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Session this turn belongs to (FK to sessions.sessionId)
   */
  @Column({ type: 'varchar', length: 255 })
  @Index('IDX_turns_session_id')
  sessionId!: string;

  /**
   * Turn number within the session (0-based)
   */
  @Column({ type: 'integer' })
  turnNumber!: number;

  /**
   * ID of the user message that started this turn
   */
  @Column({ type: 'varchar', length: 255 })
  userMessageId!: string;

  /**
   * ID of the assistant response message (null until completion)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  assistantMessageId!: string | null;

  /**
   * Total tokens used in this turn
   */
  @Column({ type: 'integer', default: 0 })
  totalTokens!: number;

  /**
   * Duration of the turn in milliseconds (time from user message to assistant completion)
   */
  @Column({ type: 'integer', default: 0 })
  durationMs!: number;

  /**
   * When the turn was created (user message received)
   */
  @CreateDateColumn()
  createdAt!: Date;

  /**
   * When the turn was completed (assistant response finished, null if in progress)
   */
  @Column({ type: 'datetime', nullable: true })
  completedAt!: Date | null;
}
