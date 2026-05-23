import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { CourseProject } from './course-project.entity';

@Entity('project_files')
@Unique(['projectId', 'path'])
export class ProjectFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column()
  path: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'file_type', default: 'json' })
  fileType: string;

  @ManyToOne(() => CourseProject, (p) => p.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: CourseProject;

  @Column({ name: 'updated_at', default: () => "datetime('now')" })
  updatedAt: string;
}
