import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique, Index } from 'typeorm';
import type { DiscussHighlightRecord } from '../../../domain/types/discuss-highlight';

@Entity('discuss_highlights')
@Unique(['sessionId', 'studentId', 'taskNum', 'clusterId'])
@Index(['sessionId', 'detectedAt'])
export class DiscussHighlight implements DiscussHighlightRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ name: 'student_name' })
  studentName: string;

  @Column({ name: 'task_num' })
  taskNum: number;

  @Column({ name: 'cluster_id' })
  clusterId: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text' })
  gist: string;

  @Column({ name: 'evidence_span', type: 'text' })
  evidenceSpan: string;

  @Column({ name: 'detected_at', type: 'bigint' })
  detectedAt: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
