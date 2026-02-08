import { Entity, Column, PrimaryColumn, CreateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Quiz } from './quiz.entity';

@Entity('quiz_analyses')
export class QuizAnalysis {
  @PrimaryColumn('varchar')
  id: string;

  @Column('varchar', { unique: true })
  quiz_id: string;

  // 1. Overall Analysis
  @Column('text', { nullable: true })
  quiz_analysis: string; // Markdown - comprehensive overview

  // 2. Knowledge Point Tags
  @Column('text', { nullable: true })
  knowledge_point_tags: string; // JSON array of KnowledgePointTag

  // 3. Thinking Process
  @Column('text', { nullable: true })
  thinking_process: string; // Markdown

  // 4. Solution Steps
  @Column('text', { nullable: true })
  solution_steps: string; // JSON array of SolutionStep

  // 5. Common Mistakes
  @Column('text', { nullable: true })
  common_mistakes: string; // JSON array of Mistake

  // 6. Knowledge Gap Analysis
  @Column('text', { nullable: true })
  knowledge_gap_analysis: string; // Markdown

  // 7. Difficulty Analysis (深度文本分析，替代数值 difficulty)
  @Column('text', { nullable: true })
  difficulty_analysis: string; // JSON - DifficultyAnalysis structure

  // 8. Related Quizzes
  @Column('text', { nullable: true })
  related_quizzes: string; // JSON array of RelatedQuiz

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
