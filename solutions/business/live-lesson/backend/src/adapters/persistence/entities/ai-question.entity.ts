import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import type { AiQuestionRecord } from '../../../domain/types/ai-question';

@Entity('reading_ai_questions')
@Index(['sessionId', 'askedAt'])
export class AiQuestion implements AiQuestionRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ name: 'student_name' })
  studentName: string;

  @Column()
  step: number;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text', nullable: true })
  answer: string;

  @Column({ nullable: true })
  category: string;

  @CreateDateColumn({ name: 'asked_at' })
  askedAt: Date;
}
