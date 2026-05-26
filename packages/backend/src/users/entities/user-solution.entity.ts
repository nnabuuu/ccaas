import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Solution } from '../../solutions/entities/solution.entity';

export type UserRole = 'admin' | 'developer' | 'viewer';

@Entity('user_tenants')
@Index(['userId', 'solutionId'], { unique: true })
export class UserSolution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  solutionId: string;

  @Column({ type: 'varchar' })
  role: UserRole;

  @Column({ default: false })
  canCreateSkills: boolean;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, (user) => user.tenants)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Solution)
  @JoinColumn({ name: 'solutionId' })
  tenant: Solution;

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
