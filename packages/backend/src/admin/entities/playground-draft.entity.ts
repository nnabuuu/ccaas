/**
 * Playground Draft Entity (§17 — exercise plugin preview design)
 *
 * Stores per-user, per-(bundle, story) draft answerKey JSON for the admin
 * Playground page. Replaces the v1 localStorage persistence so drafts
 * survive across devices and can be shared via short codes.
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('playground_drafts')
@Unique('UQ_playground_drafts_user_bundle_story', ['userId', 'bundleId', 'storyName'])
@Index('IDX_playground_drafts_user_id', ['userId'])
@Index('IDX_playground_drafts_bundle_id', ['bundleId'])
export class PlaygroundDraft {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Owning user / API key. Drafts are private per user.
   */
  @Column({ type: 'varchar', length: 64 })
  userId!: string;

  /**
   * Bundle / exercise type identifier this draft targets.
   */
  @Column({ type: 'varchar', length: 80 })
  bundleId!: string;

  /**
   * Story name within the bundle.
   */
  @Column({ type: 'varchar', length: 120 })
  storyName!: string;

  /**
   * Draft answerKey JSON payload (free-form so plugin extension bundles can
   * define their own shapes — validated by plugin.answerKeySchema at read
   * time, not in the database).
   */
  @Column({ type: 'simple-json' })
  payload!: Record<string, unknown>;

  /**
   * Optional notes the editor wants to keep alongside the draft.
   */
  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
