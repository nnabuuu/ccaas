import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('recipes')
export class Recipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  cuisine: string;

  @Column()
  difficulty: string;

  @Column({ default: 0 })
  prep_time: number;

  @Column({ default: 0 })
  cook_time: number;

  @Column({ default: 1 })
  servings: number;

  @Column({ default: 'draft' })
  status: string;

  @Column({ type: 'simple-json', nullable: true })
  blocks: any[];
}
