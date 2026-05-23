/**
 * ObservationRecordView — the shape domain code reads from an observation row.
 *
 * The TypeORM `ObservationRecord` entity lives in the `@kedge-agentic/observer-engine`
 * package (out of our control). Its column shape happens to match this interface
 * structurally, so the `Repository<ObservationRecord>` adapter can satisfy a
 * `ObservationRecordRepoPort` without an `implements` clause on the external class.
 */
export interface ObservationRecordView {
  id: string;
  sessionId: string;
  entityId: string;
  tenantId: string;
  type: string;
  data: Record<string, unknown>;
  triggerEventId: string;
  createdAtEpoch: number;
  updatedAtEpoch: number;
}
