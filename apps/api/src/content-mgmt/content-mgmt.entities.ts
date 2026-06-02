import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import type { ContentStatus, Platform } from '@tizhice/shared';

@Entity('content_drafts')
@Index('IDX_content_drafts_platform_status_created', ['platform', 'status', 'createdAt'])
export class ContentDraftEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ name: 'task_id', type: 'varchar', length: 128 })
  taskId!: string;

  @Column({ type: 'varchar', length: 64 })
  platform!: Platform;

  @Column({ type: 'varchar', length: 32 })
  status!: ContentStatus;

  @Column({ type: 'varchar', length: 256 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'script_json', type: 'jsonb', nullable: true })
  scriptJson!: unknown | null;

  @Column({ type: 'jsonb' })
  tags!: string[];

  @Column({ name: 'compliance_flags', type: 'jsonb', nullable: true })
  complianceFlags!: string[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'published_by', type: 'varchar', length: 128, nullable: true })
  publishedBy!: string | null;

  @Column({ name: 'published_platform', type: 'varchar', length: 128, nullable: true })
  publishedPlatform!: string | null;
}

@Entity('content_versions')
@Index('IDX_content_versions_draft_edited', ['draftId', 'editedAt'])
export class ContentVersionEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ name: 'draft_id', type: 'varchar', length: 128 })
  draftId!: string;

  @Column({ name: 'edited_by', type: 'varchar', length: 128 })
  editedBy!: string;

  @CreateDateColumn({ name: 'edited_at', type: 'timestamptz' })
  editedAt!: Date;

  @Column({ type: 'text' })
  diff!: string;
}
