import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { PaymentOrderEntity, PaymentTxnLogEntity } from './payment.entities';

describe('payment entities', () => {
  it('map order and txn log tables with active-order and idempotency uniqueness', () => {
    expect(tableName(PaymentOrderEntity)).toBe('payment_orders');
    expect(tableName(PaymentTxnLogEntity)).toBe('payment_txn_logs');
    expect(columnNames(PaymentOrderEntity)).toEqual(
      expect.arrayContaining([
        'id',
        'userId',
        'reportId',
        'amount',
        'currency',
        'status',
        'wxPrepayId',
        'wxTransactionId',
        'callbackVerified',
        'reconciled',
      ]),
    );
    expect(
      getMetadataArgsStorage().indices.some(
        (index) =>
          index.target === PaymentOrderEntity &&
          index.unique === true &&
          index.where === "status IN ('PENDING','PAID')",
      ),
    ).toBe(true);
    expect(columnNames(PaymentTxnLogEntity)).toEqual(
      expect.arrayContaining(['orderId', 'type', 'signatureValid', 'rawCiphertext']),
    );
  });
});

type EntityConstructor = new (...args: never[]) => unknown;

function tableName(target: EntityConstructor): string | undefined {
  return getMetadataArgsStorage().tables.find((candidate) => candidate.target === target)?.name;
}

function columnNames(target: EntityConstructor): string[] {
  return getMetadataArgsStorage()
    .columns.filter((candidate) => candidate.target === target)
    .map((column) => column.propertyName);
}
