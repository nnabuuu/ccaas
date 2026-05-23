import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, BeforeInsert, BeforeUpdate } from 'typeorm';

/** Hard cap per message — prevents DB bloat and SSE serialization issues */
export const CHAT_MESSAGE_MAX_LENGTH = 10000;

@Entity('chat_messages')
@Index(['sessionId', 'studentId', 'threadId', 'seq'], { unique: true })
@Index(['sessionId'])
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ name: 'thread_id' })
  threadId: string;

  @Column()
  role: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  images: string | null;

  @Column({ name: 'image_description', type: 'text', nullable: true })
  imageDescription: string | null;

  @Column()
  seq: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  truncateContent(): void {
    if (this.content && this.content.length > CHAT_MESSAGE_MAX_LENGTH) {
      this.content = this.content.slice(0, CHAT_MESSAGE_MAX_LENGTH) + '…';
    }
  }
}
