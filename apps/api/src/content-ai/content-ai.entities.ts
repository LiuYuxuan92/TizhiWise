import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { KnowledgeCategory, Platform, TaskStatus } from '@tizhice/shared';

@Entity('agent_workflow_configs')
export class AgentWorkflowConfigEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  version!: string;

  @Column({ name: 'payload_json', type: 'jsonb' })
  payloadJson!: unknown;

  @CreateDateColumn({ name: 'published_at', type: 'timestamptz' })
  publishedAt!: Date;
}

@Entity('knowledge_entries')
export class KnowledgeEntryEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  category!: KnowledgeCategory;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}

@Entity('content_gen_tasks')
export class ContentGenTaskEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ name: 'operator_id', type: 'varchar', length: 128 })
  operatorId!: string;

  @Column({ type: 'jsonb' })
  platforms!: Platform[];

  @Column({ type: 'varchar', length: 256 })
  topic!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: TaskStatus;

  @Column({ name: 'workflow_version', type: 'varchar', length: 64 })
  workflowVersion!: string;

  @Column({ name: 'model_versions_json', type: 'jsonb' })
  modelVersionsJson!: unknown;

  @Column({ name: 'prompt_versions_json', type: 'jsonb' })
  promptVersionsJson!: unknown;

  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'failure_reason', type: 'varchar', length: 128, nullable: true })
  failureReason!: string | null;

  @Column({ name: 'outputs_json', type: 'jsonb' })
  outputsJson!: unknown;
}
