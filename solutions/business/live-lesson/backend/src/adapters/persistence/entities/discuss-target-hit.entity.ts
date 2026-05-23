import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';
import type { DiscussTargetHitRecord } from '../../../domain/types/discuss-target-hit';

@Entity('discuss_target_hits')
@Unique(['sessionId', 'studentId', 'taskNum', 'targetPointId'])
export class DiscussTargetHit implements DiscussTargetHitRecord {
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

  @Column({ name: 'target_point_id' })
  targetPointId: string;

  @Column({ name: 'evidence_span', type: 'text', default: '' })
  evidenceSpan: string;

  @Column({ name: 'hit_at', type: 'bigint' })
  hitAt: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
