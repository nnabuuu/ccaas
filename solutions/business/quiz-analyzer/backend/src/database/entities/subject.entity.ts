import { Entity, Column, PrimaryColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Quiz } from './quiz.entity';

@Entity('subjects')
export class Subject {
  @PrimaryColumn('varchar')
  id: string;

  @Column('varchar')
  name: string;

  @Column('varchar', { nullable: true })
  code: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('text', { nullable: true })
  grade_levels: string; // JSON array

  @Column('integer', { default: 0 })
  has_formula: number;

  @CreateDateColumn({ type: 'text' })
  created_at: string;

  // Relations
  @OneToMany(() => Quiz, quiz => quiz.subject)
  quizzes: Quiz[];
}
