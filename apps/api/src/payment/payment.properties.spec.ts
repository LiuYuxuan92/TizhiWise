import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { OrderStatus, ReportTier } from '@tizhice/shared';
import { createPaymentFixture, invalidCallback, validCallback } from './payment-test-fixtures';
import { DuplicatePaymentError, InvalidPaymentCallbackError } from './payment.service';

describe('PaymentService properties', () => {
  it('Property 10: repeated valid callback is idempotent', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 5 }), async (repeatCount) => {
        const { paymentService, paymentRepository, createReport } = await createPaymentFixture();
        const report = await createReport('p10-user');
        const order = await paymentService.createOrder({
          userId: 'p10-user',
          reportId: report.id,
          idempotencyKey: 'p10-key',
        });
        const callback = validCallback(order.orderId, 'p10-nonce');

        for (let index = 0; index < repeatCount; index += 1) {
          await paymentService.handleCallback(callback.rawBody, callback.headers);
        }

        expect(await paymentService.queryStatus(order.orderId)).toBe(OrderStatus.PAID);
        expect(
          (await paymentRepository.listTxnLogs(order.orderId)).filter(
            (log) => log.type === 'CALLBACK' && log.signatureValid,
          ),
        ).toHaveLength(1);
      }),
    );
  });

  it('Property 11: illegal order state transitions are rejected by the repository state machine', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(OrderStatus.PENDING, OrderStatus.PAID), async (initial) => {
        const { paymentService, paymentRepository, createReport } = await createPaymentFixture();
        const report = await createReport('p11-user');
        const created = await paymentService.createOrder({
          userId: 'p11-user',
          reportId: report.id,
          idempotencyKey: 'p11-key',
        });
        if (initial === OrderStatus.PAID) {
          const callback = validCallback(created.orderId, 'p11-nonce');
          await paymentService.handleCallback(callback.rawBody, callback.headers);
        }
        const order = await paymentService.getOrder(created.orderId);

        await expect(
          paymentRepository.updateOrder({
            ...order,
            status: initial === OrderStatus.PENDING ? OrderStatus.REFUNDED : OrderStatus.CLOSED,
          }),
        ).rejects.toThrow(/Illegal payment order transition/);
      }),
    );
  });

  it('Property 12: same active user/report cannot be paid twice', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 16 }), async (suffix) => {
        const { paymentService, createReport } = await createPaymentFixture();
        const report = await createReport('p12-user');
        await paymentService.createOrder({
          userId: 'p12-user',
          reportId: report.id,
          idempotencyKey: `first-${suffix}`,
        });

        await expect(
          paymentService.createOrder({
            userId: 'p12-user',
            reportId: report.id,
            idempotencyKey: `second-${suffix}`,
          }),
        ).rejects.toBeInstanceOf(DuplicatePaymentError);
      }),
    );
  });

  it('Property 13: invalid signature never changes state or grants deep access', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 3 }), async (repeatCount) => {
        const { paymentService, reportService, createReport } = await createPaymentFixture();
        const report = await createReport('p13-user');
        const order = await paymentService.createOrder({
          userId: 'p13-user',
          reportId: report.id,
          idempotencyKey: 'p13-key',
        });
        const callback = invalidCallback(order.orderId);

        for (let index = 0; index < repeatCount; index += 1) {
          await expect(
            paymentService.handleCallback(callback.rawBody, callback.headers),
          ).rejects.toBeInstanceOf(InvalidPaymentCallbackError);
        }

        expect(await paymentService.queryStatus(order.orderId)).toBe(OrderStatus.PENDING);
        expect((await reportService.getReport(report.id, 'p13-user')).tier).toBe(ReportTier.BASIC);
      }),
    );
  });

  it('Property 15: refund revokes deep report access', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 32 }), async (reason) => {
        const { paymentService, reportService, createReport } = await createPaymentFixture();
        const report = await createReport('p15-user');
        const order = await paymentService.createOrder({
          userId: 'p15-user',
          reportId: report.id,
          idempotencyKey: 'p15-key',
        });
        const callback = validCallback(order.orderId, 'p15-nonce');
        await paymentService.handleCallback(callback.rawBody, callback.headers);
        expect((await reportService.getReport(report.id, 'p15-user')).tier).toBe(ReportTier.DEEP);

        await paymentService.refund({
          orderId: order.orderId,
          reason,
          operator: 'admin-p15',
        });

        expect(await paymentService.queryStatus(order.orderId)).toBe(OrderStatus.REFUNDED);
        expect((await reportService.getReport(report.id, 'p15-user')).tier).toBe(ReportTier.BASIC);
      }),
    );
  });

  it('Property 16: timeout close allows reissuing a new order', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), async (ttlMs) => {
        const { paymentService, createReport } = await createPaymentFixture({
          pendingTtlMs: ttlMs,
        });
        const report = await createReport('p16-user');
        const oldOrder = await paymentService.createOrder({
          userId: 'p16-user',
          reportId: report.id,
          idempotencyKey: 'p16-old',
        });

        await paymentService.closeExpiredOrders(new Date(Date.now() + ttlMs + 10_000));
        const newOrder = await paymentService.createOrder({
          userId: 'p16-user',
          reportId: report.id,
          idempotencyKey: 'p16-new',
        });

        expect(await paymentService.queryStatus(oldOrder.orderId)).toBe(OrderStatus.CLOSED);
        expect(newOrder.orderId).not.toBe(oldOrder.orderId);
      }),
    );
  });
});
