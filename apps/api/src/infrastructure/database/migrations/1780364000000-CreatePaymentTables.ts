import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentTables1780364000000 implements MigrationInterface {
  name = 'CreatePaymentTables1780364000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payment_orders (
        id varchar(128) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        report_id varchar(64) NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        amount integer NOT NULL,
        currency varchar(8) NOT NULL,
        status varchar(32) NOT NULL,
        wx_prepay_id varchar(128),
        wx_transaction_id varchar(128),
        created_at timestamptz NOT NULL DEFAULT now(),
        paid_at timestamptz,
        closed_at timestamptz,
        refunded_at timestamptz,
        refund_operator varchar(128),
        idempotency_key varchar(128) NOT NULL,
        callback_verified boolean NOT NULL DEFAULT false,
        reconciled boolean NOT NULL DEFAULT false
      )
    `);
    await queryRunner.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS UQ_payment_orders_user_report_active ON payment_orders (user_id, report_id) WHERE status IN ('PENDING','PAID')",
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS UQ_payment_orders_user_idempotency ON payment_orders (user_id, idempotency_key)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payment_txn_logs (
        id varchar(128) PRIMARY KEY,
        order_id varchar(128) NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
        type varchar(32) NOT NULL,
        signature_valid boolean,
        raw_ciphertext text,
        occurred_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS payment_txn_logs');
    await queryRunner.query('DROP INDEX IF EXISTS UQ_payment_orders_user_idempotency');
    await queryRunner.query('DROP INDEX IF EXISTS UQ_payment_orders_user_report_active');
    await queryRunner.query('DROP TABLE IF EXISTS payment_orders');
  }
}
