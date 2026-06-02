import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import type { ConsentScope } from '@tizhice/shared';

@Entity('users')
@Index('UQ_users_wx_openid_ciphertext', ['wxOpenIdCiphertext'], { unique: true })
export class UserEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'wx_openid_ciphertext', type: 'text' })
  wxOpenIdCiphertext!: string;

  @Column({ name: 'wx_unionid_ciphertext', type: 'text', nullable: true })
  wxUnionIdCiphertext!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  nickname!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'consent_scopes', type: 'jsonb' })
  consentScopes!: ConsentScope[];

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}

@Entity('consents')
@Index('IDX_consents_user_scope', ['userId', 'scope'])
export class ConsentEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'varchar', length: 64 })
  scope!: ConsentScope;

  @CreateDateColumn({ name: 'granted_at', type: 'timestamptz' })
  grantedAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
