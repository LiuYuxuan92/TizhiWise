import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import type { Currency, OrderStatus } from '@tizhice/shared';

@Entity('payment_orders')
@Index('UQ_payment_orders_user_report_active', ['userId', 'reportId'], {
  unique: true,
  where: "status IN ('PENDING','PAID')",
})
@Index('UQ_payment_orders_user_idempotency', ['userId', 'idempotencyKey'], { unique: true })
export class PaymentOrderEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64 })
  userId!: string;

  @Column({ name: 'report_id', type: 'varchar', length: 64 })
  reportId!: string;

  @Column({ type: 'integer' })
  amount!: number;

  @Column({ type: 'varchar', length: 8 })
  currency!: Currency;

  @Column({ type: 'varchar', length: 32 })
  status!: OrderStatus;

  @Column({ name: 'wx_prepay_id', type: 'varchar', length: 128, nullable: true })
  wxPrepayId!: string | null;

  @Column({ name: 'wx_transaction_id', type: 'varchar', length: 128, nullable: true })
  wxTransactionId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt!: Date | null;

  @Column({ name: 'refund_operator', type: 'varchar', length: 128, nullable: true })
  refundOperator!: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey!: string;

  @Column({ name: 'callback_verified', type: 'boolean', default: false })
  callbackVerified!: boolean;

  @Column({ type: 'boolean', default: false })
  reconciled!: boolean;
}

@Entity('payment_txn_logs')
export class PaymentTxnLogEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ name: 'order_id', type: 'varchar', length: 128 })
  orderId!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: 'CREATE' | 'CALLBACK' | 'REFUND' | 'CLOSE';

  @Column({ name: 'signature_valid', type: 'boolean', nullable: true })
  signatureValid!: boolean | null;

  @Column({ name: 'raw_ciphertext', type: 'text', nullable: true })
  rawCiphertext!: string | null;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
