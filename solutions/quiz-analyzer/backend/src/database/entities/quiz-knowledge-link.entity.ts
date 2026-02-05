import { Entity, Column, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Quiz } from './quiz.entity';
import { KnowledgePoint } from './knowledge-point.entity';

@Entity('quiz_knowledge_links')
export class QuizKnowledgeLink {
  @PrimaryColumn('varchar')
  id: string;

  @Column('varchar')
  quiz_id: string;

  @Column('varchar')
  knowledge_point_id: string;

  @Column('real', { default: 1.0 })
  confidence_score: number; // 0.0-1.0

  @Column('varchar', { default: 'manual' })
  link_type: string; // manual, ai-generated, ai-verified

  @CreateDateColumn({ type: 'text' })
  created_at: string;

  @Column('varchar', { nullable: true })
  created_by: string; // system, ai, or user_id

  // Relations
  @ManyToOne(() => Quiz, quiz => quiz.knowledge_links, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: Quiz;

  @ManyToOne(() => KnowledgePoint, kp => kp.quiz_links, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledge_point_id' })
  knowledge_point: KnowledgePoint;
}
