/**
 * Conversation Context Entity
 *
 * Captures session-level causality information:
 * - System prompt hash (links to SystemPromptVersion)
 * - Skill config hashes (for reproducibility)
 * - Available MCP tools at session start
 * - Model configuration
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('conversation_contexts')
@Index('IDX_conversation_contexts_session_id', ['sessionId'], { unique: true })
@Index('IDX_conversation_contexts_solution_id', ['solutionId'])
@Index('IDX_conversation_contexts_created_at', ['createdAt'])
export class ConversationContext {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index('IDX_conversation_contexts_session_id_col')
  sessionId!: string;

  @Column({ type: 'varchar', nullable: true })
  solutionId!: string | null;

  /**
   * Hash of the system prompt used (links to SystemPromptVersion)
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  systemPromptHash!: string | null;

  /**
   * Hashes of skill configurations active at session start
   * Stored as JSON array of { slug: string, hash: string }
   */
  @Column({ type: 'simple-json', nullable: true })
  skillConfigHashes!: Array<{ slug: string; hash: string }> | null;

  /**
   * List of MCP tools available at session start
   * Stored as JSON array of tool names
   */
  @Column({ type: 'simple-json', nullable: true })
  mcpToolsList!: string[] | null;

  /**
   * Model used for this session (e.g., 'claude-opus-4.5')
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  model!: string | null;

  /**
   * Initial workspace directory path
   */
  @Column({ type: 'text', nullable: true })
  workspaceDir!: string | null;

  /**
   * Client ID that initiated the session
   */
  @Column({ type: 'varchar', nullable: true })
  clientId!: string | null;

  /**
   * Additional context metadata (extensible)
   */
  @Column({ type: 'simple-json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
