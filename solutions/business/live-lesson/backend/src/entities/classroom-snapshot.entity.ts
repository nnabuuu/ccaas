import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('classroom_snapshots')
@Index(['sessionId', 'capturedAt'])
export class ClassroomSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'captured_at', type: 'datetime' })
  capturedAt: Date;

  @Column({ name: 'state_json', type: 'text' })
  stateJson: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
