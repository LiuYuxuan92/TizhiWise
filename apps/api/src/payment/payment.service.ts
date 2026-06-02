import {
  OrderStatus,
  type CreateOrderInput,
  type CreateOrderResult,
  type PaymentOrder,
  type RefundInput,
  type RefundResult,
  type WxCallbackHeaders,
} from '@tizhice/shared';
import type { ReportService } from '../report/report.service';
import { InMemoryPaymentRepository, newPendingOrder } from './in-memory-payment.repository';
import type { WechatPayGateway } from './wechat-pay.gateway';

interface PaymentServiceDependencies {
  repository: InMemoryPaymentRepository;
  reportService: ReportService;
  wechatGateway: WechatPayGateway;
  amountFen?: number;
  pendingTtlMs?: number;
}

export class DuplicatePaymentError extends Error {
  static override readonly name = 'DuplicatePaymentError';
  override readonly name = DuplicatePaymentError.name;
}

export class InvalidPaymentCallbackError extends Error {
  static override readonly name = 'InvalidPaymentCallbackError';
  override readonly name = InvalidPaymentCallbackError.name;
}

export class PaymentService {
  private readonly amountFen: number;
  private readonly pendingTtlMs: number;

  constructor(private readonly dependencies: PaymentServiceDependencies) {
    this.amountFen = dependencies.amountFen ?? 1990;
    this.pendingTtlMs = dependencies.pendingTtlMs ?? 30 * 60 * 1000;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const idempotent = await this.dependencies.repository.findByIdempotencyKey(
      input.userId,
      input.idempotencyKey,
    );
    if (idempotent) {
      return this.toCreateOrderResult(idempotent);
    }

    const active = await this.dependencies.repository.findActiveByReport(
      input.userId,
      input.reportId,
    );
    if (active?.status === OrderStatus.PAID) {
      throw new DuplicatePaymentError('Report is already paid');
    }
    if (active?.status === OrderStatus.PENDING) {
      throw new DuplicatePaymentError('A pending order already exists for this report');
    }

    const orderId = this.dependencies.repository.nextOrderId();
    const { prepayId, jsapiParams } = await this.dependencies.wechatGateway.createJsapiParams({
      orderId,
      userId: input.userId,
      reportId: input.reportId,
      amount: this.amountFen,
    });
    const order = newPendingOrder({
      id: orderId,
      userId: input.userId,
      reportId: input.reportId,
      idempotencyKey: input.idempotencyKey,
      amount: this.amountFen,
      wxPrepayId: prepayId,
      createdAt: new Date(),
    });
    await this.dependencies.repository.saveOrder(order);
    await this.dependencies.repository.recordTxn({ orderId, type: 'CREATE' });
    return { orderId, jsapiParams };
  }

  async handleCallback(rawBody: Buffer, headers: WxCallbackHeaders): Promise<void> {
    const verified = await this.dependencies.wechatGateway.verifyCallback(rawBody, headers);
    if (!verified) {
      await this.recordInvalidCallback(rawBody);
      throw new InvalidPaymentCallbackError('Invalid WeChat Pay callback signature');
    }
    if (await this.dependencies.repository.hasCallbackNonce(verified.nonce)) {
      return;
    }

    const order = await this.dependencies.repository.getOrderOrThrow(verified.orderId);
    if (order.status === OrderStatus.PAID) {
      await this.dependencies.repository.markCallbackNonce(verified.nonce);
      return;
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new Error(`Cannot pay order in status ${order.status}`);
    }

    const paid: PaymentOrder = {
      ...order,
      status: OrderStatus.PAID,
      paidAt: verified.paidAt,
      wxTransactionId: verified.transactionId,
      callbackVerified: true,
      reconciled: true,
    };
    await this.dependencies.repository.updateOrder(paid);
    await this.dependencies.repository.markCallbackNonce(verified.nonce);
    await this.dependencies.repository.recordTxn({
      orderId: paid.id,
      type: 'CALLBACK',
      signatureValid: true,
    });
    await this.dependencies.reportService.grantDeepAccess(paid.reportId, paid.userId, paid.id);
  }

  async queryStatus(orderId: string): Promise<OrderStatus> {
    return (await this.dependencies.repository.getOrderOrThrow(orderId)).status;
  }

  async closeExpiredOrders(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - this.pendingTtlMs);
    const expired = await this.dependencies.repository.listPendingCreatedBefore(cutoff);
    for (const order of expired) {
      await this.dependencies.repository.updateOrder({
        ...order,
        status: OrderStatus.CLOSED,
        closedAt: now,
      });
      await this.dependencies.repository.recordTxn({ orderId: order.id, type: 'CLOSE' });
    }
    return expired.length;
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const order = await this.dependencies.repository.getOrderOrThrow(input.orderId);
    if (order.status !== OrderStatus.PAID) {
      throw new Error(`Cannot refund order in status ${order.status}`);
    }
    const refund = await this.dependencies.wechatGateway.refund({
      orderId: order.id,
      reason: input.reason,
      amount: order.amount,
    });
    await this.dependencies.repository.updateOrder({
      ...order,
      status: OrderStatus.REFUNDED,
      refundedAt: new Date(),
      refundOperator: input.operator,
    });
    await this.dependencies.repository.recordTxn({ orderId: order.id, type: 'REFUND' });
    await this.dependencies.reportService.revokeDeepAccess(order.reportId, order.userId);
    return refund;
  }

  async isDuplicate(userId: string, reportId: string): Promise<boolean> {
    return Boolean(await this.dependencies.repository.findActiveByReport(userId, reportId));
  }

  async getOrder(orderId: string): Promise<PaymentOrder> {
    return this.dependencies.repository.getOrderOrThrow(orderId);
  }

  private async toCreateOrderResult(order: PaymentOrder): Promise<CreateOrderResult> {
    if (!order.wxPrepayId) {
      throw new Error(`Order ${order.id} has no prepay id`);
    }
    const { jsapiParams } = await this.dependencies.wechatGateway.createJsapiParams({
      orderId: order.id,
      userId: order.userId,
      reportId: order.reportId,
      amount: order.amount,
    });
    return { orderId: order.id, jsapiParams };
  }

  private async recordInvalidCallback(rawBody: Buffer): Promise<void> {
    let orderId = 'unknown';
    try {
      orderId = (JSON.parse(rawBody.toString('utf8')) as { orderId?: string }).orderId ?? 'unknown';
    } catch {
      // keep unknown
    }
    await this.dependencies.repository.recordTxn({
      orderId,
      type: 'CALLBACK',
      signatureValid: false,
    });
  }
}
