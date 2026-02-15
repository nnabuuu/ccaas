import { Entity, Column, PrimaryColumn, Index, CreateDateColumn } from 'typeorm';

@Entity('turns')
@Index('idx_turns_session_number', ['session_id', 'turn_number'])
export class Turn {
  @PrimaryColumn('varchar')
  id: string; // turn_{uuid}

  @Column('varchar')
  session_id: string;

  @Column('integer')
  turn_number: number;

  @Column('varchar')
  user_message_id: string;

  @Column('varchar', { nullable: true })
  assistant_message_id: string;

  @Column('integer', { default: 0 })
  total_tokens: number;

  @Column('integer', { default: 0 })
  duration_ms: number;

  @CreateDateColumn({ type: 'text' })
  created_at: string;

  @Column('text', { nullable: true })
  completed_at: string;
}
