/**
 * `OntologyEventOutbox` — durable buffer of events queued for delivery
 * to the platform Workflow engine.
 *
 * Lifecycle:
 *   - `state='pending'` → drain worker picks up + tries to push
 *   - on success (accepted / duplicate / disabled from platform) →
 *     `state='delivered', deliveredAt=now`
 *   - on retryable failure → `attempts++, lastError=…, nextAttemptAt=now+backoff()`
 *   - on terminal failure (4xx) → `state='poisoned', lastError=…`
 *
 * Drain query: `where state='pending' and nextAttemptAt <= now order by createdAt asc limit N`
 *
 * Dedup is the platform's job (M1 ObserverEventRepository.hasEvent) —
 * the outbox only needs to be at-least-once.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

export type OntologyEventOutboxState = 'pending' | 'delivered' | 'poisoned';

@Entity('ontology_event_outbox')
@Index('IDX_outbox_state_nextAttempt', ['state', 'nextAttemptAtEpoch'])
@Index('IDX_outbox_eventId', ['eventId'], { unique: true })
export class OntologyEventOutbox {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable id used by the platform for cross-process dedup. */
  @Column({ type: 'text' })
  eventId!: string;

  @Column({ type: 'text' })
  sessionId!: string;

  @Column({ type: 'text' })
  manifestName!: string;

  @Column({ type: 'text' })
  streamApiName!: string;

  @Column({ type: 'text' })
  entityId!: string;

  /** JSON-stringified payload. Service layer parses on push. */
  @Column({ type: 'text' })
  payloadJson!: string;

  @Column({ type: 'text', nullable: true })
  correlationId!: string | null;

  @Column({ type: 'text', default: 'pending' })
  state!: OntologyEventOutboxState;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  /** Epoch ms — next time the worker should retry. Defaults to "now-ish". */
  @Column({ type: 'integer', name: 'nextAttemptAtEpoch' })
  nextAttemptAtEpoch!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'integer', nullable: true })
  deliveredAtEpoch!: number | null;
}
