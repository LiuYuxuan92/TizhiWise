import { describe, expect, it } from 'vitest';
import { OrderStatus, ReportTier } from '@tizhice/shared';
import { createPaymentFixture, invalidCallback, validCallback } from './payment-test-fixtures';
import { DuplicatePaymentError, InvalidPaymentCallbackError } from './payment.service';

describe('PaymentService', () => {
  it('creates a unique pending JSAPI order and is idempotent by user idempotency key', async () => {
    const { paymentService, createReport } = await createPaymentFixture();
    const report = await createReport('pay-user');

    const first = await paymentService.createOrder({
      userId: 'pay-user',
      reportId: report.id,
      idempotencyKey: 'idem-1',
    });
    const duplicate = await paymentService.createOrder({
      userId: 'pay-user',
      reportId: report.id,
      idempotencyKey: 'idem-1',
    });

    expect(duplicate.orderId).toBe(first.orderId);
    expect(first.jsapiParams.package).toContain(`prepay-${first.orderId}`);
    await expect(paymentService.queryStatus(first.orderId)).resolves.toBe(OrderStatus.PENDING);
  });

  it('rejects duplicate active payment for the same user/report with a different key', async () => {
    const { paymentService, createReport } = await createPaymentFixture();
    const report = await createReport('pay-dup');
    await paymentService.createOrder({
      userId: 'pay-dup',
      reportId: report.id,
      idempotencyKey: 'idem-1',
    });

    await expect(
      paymentService.createOrder({
        userId: 'pay-dup',
        reportId: report.id,
        idempotencyKey: 'idem-2',
      }),
    ).rejects.toBeInstanceOf(DuplicatePaymentError);
  });

  it('handles valid callback idempotently and grants deep report access exactly once', async () => {
    const { paymentService, paymentRepository, reportService, createReport } =
      await createPaymentFixture();
    const report = await createReport('pay-callback');
    const order = await paymentService.createOrder({
      userId: 'pay-callback',
      reportId: report.id,
      idempotencyKey: 'idem-callback',
    });
    const callback = validCallback(order.orderId, 'nonce-repeat');

    await paymentService.handleCallback(callback.rawBody, callback.headers);
    await paymentService.handleCallback(callback.rawBody, callback.headers);

    await expect(paymentService.queryStatus(order.orderId)).resolves.toBe(OrderStatus.PAID);
    await expect(reportService.getReport(report.id, 'pay-callback')).resolves.toMatchObject({
      tier: ReportTier.DEEP,
      payload: { deep: { masked: false } },
    });
    expect(
      (await paymentRepository.listTxnLogs(order.orderId)).filter(
        (log) => log.type === 'CALLBACK' && log.signatureValid,
      ),
    ).toHaveLength(1);
  });

  it('does not change order state or grant access before callback signature verification', async () => {
    const { paymentService, reportService, createReport } = await createPaymentFixture();
    const report = await createReport('pay-invalid');
    const order = await paymentService.createOrder({
      userId: 'pay-invalid',
      reportId: report.id,
      idempotencyKey: 'idem-invalid',
    });
    const callback = invalidCallback(order.orderId);

    await expect(
      paymentService.handleCallback(callback.rawBody, callback.headers),
    ).rejects.toBeInstanceOf(InvalidPaymentCallbackError);

    await expect(paymentService.queryStatus(order.orderId)).resolves.toBe(OrderStatus.PENDING);
    await expect(reportService.getReport(report.id, 'pay-invalid')).resolves.toMatchObject({
      tier: ReportTier.BASIC,
      payload: { deep: { masked: true } },
    });
  });

  it('closes expired pending orders and then allows a new order for the same report', async () => {
    const { paymentService, createReport } = await createPaymentFixture({ pendingTtlMs: 10 });
    const report = await createReport('pay-expired');
    const order = await paymentService.createOrder({
      userId: 'pay-expired',
      reportId: report.id,
      idempotencyKey: 'old-key',
    });

    const closed = await paymentService.closeExpiredOrders(new Date(Date.now() + 60_000));
    const recreated = await paymentService.createOrder({
      userId: 'pay-expired',
      reportId: report.id,
      idempotencyKey: 'new-key',
    });

    expect(closed).toBe(1);
    await expect(paymentService.queryStatus(order.orderId)).resolves.toBe(OrderStatus.CLOSED);
    expect(recreated.orderId).not.toBe(order.orderId);
  });

  it('refunds paid orders and revokes deep report access', async () => {
    const { paymentService, reportService, createReport } = await createPaymentFixture();
    const report = await createReport('pay-refund');
    const order = await paymentService.createOrder({
      userId: 'pay-refund',
      reportId: report.id,
      idempotencyKey: 'idem-refund',
    });
    const callback = validCallback(order.orderId);
    await paymentService.handleCallback(callback.rawBody, callback.headers);

    const refund = await paymentService.refund({
      orderId: order.orderId,
      reason: 'admin test refund',
      operator: 'admin-1',
    });

    expect(refund.refundId).toBe(`refund-${order.orderId}`);
    await expect(paymentService.queryStatus(order.orderId)).resolves.toBe(OrderStatus.REFUNDED);
    await expect(reportService.getReport(report.id, 'pay-refund')).resolves.toMatchObject({
      tier: ReportTier.BASIC,
      payload: { deep: { masked: true } },
    });
  });
});
