import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import type { ReportTier, ReportType } from '@tizhice/shared';

@Entity('reports')
@Index('IDX_reports_user_created_at', ['userId', 'createdAt'])
export class ReportEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64, nullable: true })
  userId!: string | null;

  @Column({ name: 'session_id', type: 'varchar', length: 64 })
  sessionId!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: ReportType;

  @Column({ type: 'varchar', length: 32 })
  tier!: ReportTier;

  @Column({ name: 'template_version', type: 'varchar', length: 64 })
  templateVersion!: string;

  @Column({ name: 'payload_ciphertext', type: 'text' })
  payloadCiphertext!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('report_deep_access')
@Index('UQ_report_deep_access_report_user_active', ['reportId', 'userId'], {
  unique: true,
  where: 'revoked_at IS NULL',
})
export class ReportDeepAccessEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ name: 'report_id', type: 'varchar', length: 64 })
  reportId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ name: 'order_id', type: 'varchar', length: 128 })
  orderId!: string;

  @CreateDateColumn({ name: 'granted_at', type: 'timestamptz' })
  grantedAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}

@Entity('report_share_links')
export class ReportShareLinkEntity {
  @PrimaryColumn({ type: 'varchar', length: 256 })
  token!: string;

  @Column({ name: 'report_id', type: 'varchar', length: 64 })
  reportId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('report_export_jobs')
export class ReportExportJobEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ name: 'report_id', type: 'varchar', length: 64 })
  reportId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: 'QUEUED' | 'COMPLETED' | 'FAILED';

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
