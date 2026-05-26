import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { AgentFile } from '../../files/entities/agent-file.entity';
import { ToolEvent } from './tool-event.entity';

export type MessageRole = 'user' | 'assistant';

export interface MessageMetadata {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  stopReason?: string;
  cachedInputTokens?: number;
  reasoningTokens?: number;
}

@Entity('messages')
@Index('IDX_messages_session_index', ['sessionId', 'messageIndex'])
@Index('IDX_messages_tenant_created_at', ['solutionId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index('IDX_messages_session_id')
  sessionId!: string;

  @Column({ type: 'varchar', nullable: true })
  @Index('IDX_messages_solution_id')
  solutionId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  role!: MessageRole;

  @Column({ type: 'text', default: '' })
  content!: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: MessageMetadata | null;

  @Column({ type: 'integer', default: 0 })
  messageIndex!: number;

  /**
   * Parent message ID for conversation branching (null for root messages)
   */
  @Column({ type: 'varchar', nullable: true })
  @Index('IDX_messages_parent_message_id')
  parentMessageId!: string | null;

  /**
   * Branch ID - groups messages in the same conversation branch
   */
  @Column({ type: 'varchar', nullable: true })
  @Index('IDX_messages_branch_id')
  branchId!: string | null;

  /**
   * Whether this message is a continuation (e.g., from session reconnect)
   */
  @Column({ type: 'boolean', default: false })
  isContinuation!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => AgentFile, (file) => file.message)
  files!: AgentFile[];

  @OneToMany(() => ToolEvent, (toolEvent) => toolEvent.message)
  toolEvents!: ToolEvent[];
}
