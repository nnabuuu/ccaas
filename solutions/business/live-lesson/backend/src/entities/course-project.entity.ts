import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ProjectFile } from './project-file.entity';

@Entity('course_projects')
export class CourseProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ default: '' })
  description: string;

  @Column({ default: 'draft' })
  status: 'draft' | 'published' | 'archived';

  @OneToMany(() => ProjectFile, (f) => f.project)
  files: ProjectFile[];

  @Column({ name: 'created_at', default: () => "datetime('now')" })
  createdAt: string;

  @Column({ name: 'updated_at', default: () => "datetime('now')" })
  updatedAt: string;
}
