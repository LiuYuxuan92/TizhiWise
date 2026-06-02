import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { ConfigKind } from '@tizhice/shared';

@Entity('config_versions')
@Unique('UQ_config_versions_kind_version', ['kind', 'version'])
@Index('UQ_config_versions_kind_active', ['kind', 'active'], {
  unique: true,
  where: 'active = true',
})
export class ConfigVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  kind!: ConfigKind;

  @Column({ type: 'varchar', length: 64 })
  version!: string;

  @Column({ name: 'payload_json', type: 'jsonb' })
  payloadJson!: unknown;

  @Column({ name: 'published_by', type: 'varchar', length: 128 })
  publishedBy!: string;

  @CreateDateColumn({ name: 'published_at', type: 'timestamptz' })
  publishedAt!: Date;

  @Column({ type: 'boolean', default: true })
  active = true;

  @Column({ type: 'boolean', default: true })
  immutable = true as const;
}
