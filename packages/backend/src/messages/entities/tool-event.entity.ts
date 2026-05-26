/**
 * Tool Event Entity
 *
 * Tracks tool invocations (start and end phases) for a message.
 * Links tool activity to the assistant message that triggered it.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Message } from './message.entity';

export type ToolEventPhase = 'start' | 'end';

export interface ToolDecisionLogic {
  why?: string;
  benefit?: string;
  nextStep?: string;
}

@Entity('tool_events')
@Index('IDX_tool_events_session_created_at', ['sessionId', 'createdAt'])
@Index('IDX_tool_events_message_created_at', ['messageId', 'createdAt'])
@Index('IDX_tool_events_tool_use_id', ['toolUseId'])
@Index('IDX_tool_events_tenant_created_at', ['solutionId', 'createdAt'])
export class ToolEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index('IDX_tool_events_message_id')
  messageId!: string;

  @ManyToOne(() => Message, (message) => message.toolEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message!: Message;

  @Column()
  @Index('IDX_tool_events_session_id')
  sessionId!: string;

  /**
   * Solution ID for multi-tenancy support
   */
  @Column({ type: 'varchar', nullable: true })
  @Index('IDX_tool_events_solution_id')
  solutionId?: string;

  @Column()
  toolUseId!: string; // Unique ID per tool invocation (links start/end)

  @Column()
  toolName!: string; // Read, Write, Bash, Glob, Grep, Task, etc.

  @Column({ type: 'varchar', length: 10 })
  phase!: ToolEventPhase; // 'start' or 'end'

  @Column({ type: 'simple-json', nullable: true })
  toolInput!: Record<string, unknown> | null; // Tool parameters

  @Column({ type: 'simple-json', nullable: true })
  toolOutput!: unknown; // Tool result (on end phase)

  @Column({ type: 'boolean', nullable: true })
  success!: boolean | null; // null for start, true/false for end

  @Column({ type: 'integer', nullable: true })
  durationMs!: number | null; // Execution time (on end phase)

  @Column({ type: 'varchar', nullable: true })
  agentType!: string | null; // 'main', 'Explore', 'lesson-plan-designer', etc.

  @Column({ type: 'simple-json', nullable: true })
  decisionLogic!: ToolDecisionLogic | null;

  /**
   * Error message text when tool execution fails (success = false)
   * Captures the actual error content for debugging
   */
  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  /**
   * Classified error type for analytics
   * Values: file_not_found, permission_denied, timeout, command_failed,
   *         network_error, parse_error, validation_error, unknown
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  errorType!: string | null;

  /**
   * Execution order within the message (1-based)
   * Tracks the sequence of tool calls
   */
  @Column({ type: 'int', nullable: true })
  executionOrder!: number | null;

  /**
   * Parent tool use ID if this tool was spawned by a Task sub-agent
   * Enables tracing tool call chains across agent hierarchy
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  parentToolUseId!: string | null;

  /**
   * Nesting level in the agent hierarchy
   * 0 = main agent, 1+ = sub-agent depth
   */
  @Column({ type: 'int', nullable: true, default: 0 })
  nestingLevel!: number | null;

  /**
   * SHA-256 hash of large output content (stored in LargeContent table)
   * If set, toolOutput will be null and content should be fetched from LargeContent
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  contentHash!: string | null;

  /**
   * Whether the output was truncated before storage
   */
  @Column({ type: 'boolean', default: false })
  truncated!: boolean;

  /**
   * Original output size in bytes (before any truncation)
   */
  @Column({ type: 'integer', nullable: true })
  originalSize!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
