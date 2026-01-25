import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Message } from '../../messages/entities/message.entity';

@Entity('agent_files')
@Index('IDX_agent_files_session_id', ['sessionId'])
@Index('IDX_agent_files_message_id', ['messageId'])
export class AgentFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  messageId!: string;

  @ManyToOne(() => Message, (message) => message.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message!: Message;

  @Column()
  @Index('IDX_agent_files_session_id_col')
  sessionId!: string;

  @Column({ type: 'varchar', nullable: true })
  tenantId!: string | null;

  @Column({ type: 'text' })
  originalPath!: string; // Path in session workspace (relative)

  @Column({ type: 'text' })
  storedPath!: string; // Path in persistent storage (absolute)

  @Column()
  filename!: string;

  @Column({ type: 'varchar', nullable: true })
  mimeType!: string | null;

  @Column({ type: 'integer', default: 0 })
  size!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
