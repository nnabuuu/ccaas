import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('activities')
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  entity_type: string;

  @Column()
  entity_id: string;

  @Column()
  entity_display_name: string;

  @Column()
  action: string;

  @Column({ type: 'simple-json', nullable: true })
  detail: Record<string, any>;

  @CreateDateColumn()
  timestamp: Date;
}
