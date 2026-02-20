import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { Subject } from './subject.entity';
import { QuizAnalysis } from './quiz-analysis.entity';

@Entity('quizzes')
export class Quiz {
  @PrimaryColumn('varchar')
  id: string;

  @Column('varchar', { default: 'default' })
  tenant_id: string;

  @Column('text')
  content: string;

  @Column('text', { nullable: true })
  content_html: string;

  @Column('text', { nullable: true })
  image_urls: string; // JSON array

  @Column('varchar')
  subject_id: string;

  @Column('varchar', { nullable: true })
  grade_level: string;

  @Column('varchar', { nullable: true })
  quiz_type: string; // 选择题, 填空题, 解答题, 证明题

  @Column('text', { nullable: true })
  source: string;

  @Column('text', { nullable: true })
  chapter_reference: string;

  @Column('text', { nullable: true })
  correct_answer: string;

  @Column('text', { nullable: true })
  answer_options: string; // JSON array

  @CreateDateColumn({ type: 'text' })
  created_at: string;

  @UpdateDateColumn({ type: 'text' })
  updated_at: string;

  // Relations
  @ManyToOne(() => Subject, subject => subject.quizzes)
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @OneToOne(() => QuizAnalysis, analysis => analysis.quiz)
  analysis: QuizAnalysis;
}
