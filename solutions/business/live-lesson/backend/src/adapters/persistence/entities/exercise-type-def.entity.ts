import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('exercise_type_defs')
export class ExerciseTypeDef {
  @PrimaryColumn({ length: 30 })
  type: string;

  @Column()
  label: string;

  @Column({ name: 'icon_url', default: '' })
  iconUrl: string;

  @Column({ name: 'badge_class', default: '' })
  badgeClass: string;

  @Column({ name: 'default_value', type: 'text', default: '{}' })
  defaultValue: string;

  @Column({ name: 'json_schema', type: 'text', default: '{}' })
  jsonSchema: string;

  @Column({ type: 'text', default: '[]' })
  refinements: string;

  @Column({ name: 'editor_component', nullable: true })
  editorComponent: string | null;

  @Column({ default: 'exercise' })
  category: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;
}
