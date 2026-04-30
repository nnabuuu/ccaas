import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('observation_events')
export class ObservationEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ name: 'event_id' })
  eventId: string;

  @Column({ type: 'simple-json' })
  anchors: string[];

  @Column({ type: 'text' })
  gist: string;

  @Column({ type: 'text', nullable: true })
  quote: string | null;

  @Column()
  source: string;

  @Column({ name: 'system_type', nullable: true })
  systemType: string | null;

  @Column({ type: 'simple-json', nullable: true })
  data: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
