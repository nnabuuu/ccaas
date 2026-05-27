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

  // Per-project teaching-requirement subjects. Drives which L1 libraries
  // get materialized into the agent's `_lib/` workspace (one file per
  // subject). Empty array = no lib materialization (project doesn't use
  // requirement library at all). Replaces the old process-global
  // LIVE_LESSON_LESSON_PLAN_SUBJECT env var so a single backend can serve
  // English + Math projects concurrently. Validated against
  // TeachingRequirementsService.listSubjects() at write boundary.
  @Column({ type: 'simple-json', default: '[]' })
  subjects: string[];

  @OneToMany(() => ProjectFile, (f) => f.project)
  files: ProjectFile[];

  @Column({ name: 'created_at', default: () => "datetime('now')" })
  createdAt: string;

  @Column({ name: 'updated_at', default: () => "datetime('now')" })
  updatedAt: string;
}
