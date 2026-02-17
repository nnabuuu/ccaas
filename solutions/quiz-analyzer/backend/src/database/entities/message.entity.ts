import { Entity, Column, PrimaryColumn, Index, CreateDateColumn } from 'typeorm';

@Entity('messages')
@Index('idx_messages_session_index', ['session_id', 'message_index'])
export class Message {
  @PrimaryColumn('varchar')
  id: string; // msg_{uuid}

  @Column('varchar')
  session_id: string;

  @Column('varchar')
  role: string; // 'user' | 'assistant' | 'system'

  @Column('text')
  content: string;

  @Column('integer')
  message_index: number;

  @Column('varchar', { nullable: true })
  parent_message_id: string;

  @Column('varchar', { nullable: true })
  branch_id: string;

  @Column('integer', { default: 0 })
  is_continuation: number; // SQLite boolean: 0 = false, 1 = true

  @Column('text', { nullable: true })
  metadata: string; // JSON: { model, inputTokens, outputTokens, ... }

  @Column('text', { nullable: true })
  tool_calls: string; // JSON array of ToolCall

  @Column('text', { nullable: true })
  thinking_blocks: string; // JSON array of ThinkingBlock

  @CreateDateColumn({ type: 'text' })
  created_at: string;
}
