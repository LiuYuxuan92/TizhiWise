import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import type { AssessmentChannel, EventType } from '@tizhice/shared';

@Entity('behavior_events')
@Index('IDX_behavior_events_occurred_type', ['occurredAt', 'type'])
export class BehaviorEventEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64, nullable: true })
  userId!: string | null;

  @Column({ name: 'anonymous_id', type: 'varchar', length: 128, nullable: true })
  anonymousId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  type!: EventType;

  @Column({ type: 'varchar', length: 32, nullable: true })
  channel!: AssessmentChannel | null;

  @Column({ name: 'channel_source', type: 'varchar', length: 128, nullable: true })
  channelSource!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}

@Entity('aggregate_exports')
export class AggregateExportEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl!: string;

  @Column({ name: 'group_by', type: 'varchar', length: 32 })
  groupBy!: 'CONSTITUTION' | 'AGE_BAND' | 'SOURCE';

  @Column({ name: 'rows_json', type: 'jsonb' })
  rowsJson!: unknown;

  @CreateDateColumn({ name: 'generated_at', type: 'timestamptz' })
  generatedAt!: Date;
}
