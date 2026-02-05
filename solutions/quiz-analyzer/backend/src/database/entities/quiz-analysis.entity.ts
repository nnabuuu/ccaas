import { Entity, Column, PrimaryColumn, CreateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Quiz } from './quiz.entity';

@Entity('quiz_analyses')
export class QuizAnalysis {
  @PrimaryColumn('varchar')
  id: string;

  @Column('varchar', { unique: true })
  quiz_id: string;

  @Column('text', { nullable: true })
  thinking_process: string; // Markdown

  @Column('text', { nullable: true })
  solution_steps: string; // JSON array of SolutionStep

  @Column('text', { nullable: true })
  common_mistakes: string; // JSON array of Mistake

  @Column('text', { nullable: true })
  knowledge_gap_analysis: string; // Markdown

  @Column('text', { nullable: true })
  difficulty_rationale: string;

  @Column('text', { nullable: true })
  time_estimate: string;

  @CreateDateColumn({ type: 'text' })
  analyzed_at: string;

  @Column('varchar', { default: '1.0' })
  analyzer_version: string;

  @Column('integer', { nullable: true })
  analysis_duration_ms: number;

  // Relations
  @OneToOne(() => Quiz, quiz => quiz.analysis, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: Quiz;
}
