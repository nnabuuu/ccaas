import { Entity, Column, PrimaryColumn, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Subject } from './subject.entity';
import { QuizKnowledgeLink } from './quiz-knowledge-link.entity';

@Entity('knowledge_points')
export class KnowledgePoint {
  @PrimaryColumn('varchar')
  id: string;

  @Column('varchar')
  subject_id: string;

  @Column('varchar', { nullable: true })
  parent_id: string;

  @Column('varchar')
  name: string;

  @Column('varchar', { nullable: true })
  code: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('integer', { default: 0 })
  level: number;

  @Column('varchar', { nullable: true })
  grade_level: string;

  @Column('real', { default: 0.5 })
  difficulty_contribution: number;

  @Column('text', { nullable: true })
  common_problem_types: string; // JSON array

  @Column('text', { nullable: true })
  related_formulas: string; // JSON array

  @CreateDateColumn({ type: 'text' })
  created_at: string;

  // Relations
  @ManyToOne(() => Subject, subject => subject.knowledge_points)
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @ManyToOne(() => KnowledgePoint, kp => kp.children)
  @JoinColumn({ name: 'parent_id' })
  parent: KnowledgePoint;

  @OneToMany(() => KnowledgePoint, kp => kp.parent)
  children: KnowledgePoint[];

  @OneToMany(() => QuizKnowledgeLink, link => link.knowledge_point)
  quiz_links: QuizKnowledgeLink[];
}
