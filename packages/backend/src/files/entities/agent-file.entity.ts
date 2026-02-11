import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Message } from '../../messages/entities/message.entity';
import { FileVersion } from './file-version.entity';

@Entity('agent_files')
@Index('IDX_agent_files_session_id', ['sessionId'])
@Index('IDX_agent_files_message_id', ['messageId'])
export class AgentFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  messageId!: string | null;

  @ManyToOne(() => Message, (message) => message.files, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'messageId' })
  message!: Message | null;

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

  @Column({ type: 'varchar', default: 'new' })
  status!: 'new' | 'modified' | 'synced';

  @Column({ type: 'datetime', nullable: true })
  downloadedAt!: Date | null;

  @Column({ type: 'varchar', default: 'agent' })
  uploadedBy!: 'agent' | 'user';

  @Column({ type: 'varchar', default: '1.0.0' })
  currentVersion!: string; // Current semantic version

  @Column({ type: 'datetime', nullable: true })
  lastVersionAt!: Date | null; // Last time a version was created

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => FileVersion, (version) => version.file, { cascade: true })
  versions!: FileVersion[];
}
