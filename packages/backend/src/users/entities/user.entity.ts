import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserSolution } from './user-solution.entity';

export type UserStatus = 'active' | 'suspended' | 'deleted';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  username?: string | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  passwordHash?: string | null;

  @Column({ type: 'varchar', default: 'active' })
  status: UserStatus;

  @OneToMany(() => UserSolution, (userTenant) => userTenant.user)
  tenants: UserSolution[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
