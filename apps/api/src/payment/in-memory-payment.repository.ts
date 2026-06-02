import { Currency, OrderStatus, type PaymentOrder } from '@tizhice/shared';

export interface PaymentTxnLog {
  id: string;
  orderId: string;
  type: 'CREATE' | 'CALLBACK' | 'REFUND' | 'CLOSE';
  signatureValid?: boolean;
  rawCiphertext?: string;
  occurredAt: Date;
}

export class InMemoryPaymentRepository {
  private orderCounter = 0;
  private txnCounter = 0;
  private readonly orders = new Map<string, PaymentOrder>();
  private readonly txnLogs: PaymentTxnLog[] = [];
  private readonly processedCallbackNonces = new Set<string>();

  nextOrderId(): string {
    this.orderCounter += 1;
    return `pay-${this.orderCounter}`;
  }

  async saveOrder(order: PaymentOrder): Promise<void> {
    this.orders.set(order.id, cloneOrder(order));
  }

  async getOrderOrThrow(orderId: string): Promise<PaymentOrder> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Payment order not found: ${orderId}`);
    }
    return cloneOrder(order);
  }

  async findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<PaymentOrder | null> {
    const order = [...this.orders.values()].find(
      (candidate) => candidate.userId === userId && candidate.idempotencyKey === idempotencyKey,
    );
    return order ? cloneOrder(order) : null;
  }

  async findActiveByReport(userId: string, reportId: string): Promise<PaymentOrder | null> {
    const order = [...this.orders.values()].find(
      (candidate) =>
        candidate.userId === userId &&
        candidate.reportId === reportId &&
        (candidate.status === OrderStatus.PENDING || candidate.status === OrderStatus.PAID),
    );
    return order ? cloneOrder(order) : null;
  }

  async listOrdersByUser(userId: string): Promise<PaymentOrder[]> {
    return [...this.orders.values()]
      .filter((order) => order.userId === userId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map(cloneOrder);
  }

  async mergeAnonymousOrders(userId: string, anonymousId: string): Promise<number> {
    const anonymousUserId = anonymousUserIdFor(anonymousId);
    let merged = 0;
    for (const order of this.orders.values()) {
      if (order.userId === anonymousUserId) {
        order.userId = userId;
        merged += 1;
      }
    }
    return merged;
  }

  async anonymizeUserOrders(userId: string, anonymizedUserId: string): Promise<number> {
    let changed = 0;
    for (const order of this.orders.values()) {
      if (order.userId === userId) {
        order.userId = anonymizedUserId;
        changed += 1;
      }
    }
    return changed;
  }

  async listPendingCreatedBefore(cutoff: Date): Promise<PaymentOrder[]> {
    return [...this.orders.values()]
      .filter(
        (order) =>
          order.status === OrderStatus.PENDING && order.createdAt.getTime() < cutoff.getTime(),
      )
      .map(cloneOrder);
  }

  async updateOrder(order: PaymentOrder): Promise<void> {
    const existing = await this.getOrderOrThrow(order.id);
    assertLegalTransition(existing.status, order.status);
    this.orders.set(order.id, cloneOrder(order));
  }

  async recordTxn(log: Omit<PaymentTxnLog, 'id' | 'occurredAt'>): Promise<void> {
    this.txnCounter += 1;
    this.txnLogs.push({
      ...log,
      id: `payment-txn-${this.txnCounter}`,
      occurredAt: new Date(),
    });
  }

  async listTxnLogs(orderId?: string): Promise<PaymentTxnLog[]> {
    return this.txnLogs
      .filter((log) => !orderId || log.orderId === orderId)
      .map((log) => ({ ...log, occurredAt: new Date(log.occurredAt) }));
  }

  async hasCallbackNonce(nonce: string): Promise<boolean> {
    return this.processedCallbackNonces.has(nonce);
  }

  async markCallbackNonce(nonce: string): Promise<void> {
    this.processedCallbackNonces.add(nonce);
  }
}

export function anonymousUserIdFor(anonymousId: string): string {
  return `anon:${anonymousId}`;
}

export function newPendingOrder(input: {
  id: string;
  userId: string;
  reportId: string;
  idempotencyKey: string;
  amount: number;
  wxPrepayId: string;
  createdAt: Date;
}): PaymentOrder {
  return {
    id: input.id,
    userId: input.userId,
    reportId: input.reportId,
    amount: input.amount,
    currency: Currency.CNY,
    status: OrderStatus.PENDING,
    wxPrepayId: input.wxPrepayId,
    createdAt: input.createdAt,
    idempotencyKey: input.idempotencyKey,
    callbackVerified: false,
    reconciled: false,
  };
}

function assertLegalTransition(from: OrderStatus, to: OrderStatus): void {
  if (from === to) {
    return;
  }
  const legal =
    (from === OrderStatus.PENDING && (to === OrderStatus.PAID || to === OrderStatus.CLOSED)) ||
    (from === OrderStatus.PAID && to === OrderStatus.REFUNDED);
  if (!legal) {
    throw new Error(`Illegal payment order transition: ${from} -> ${to}`);
  }
}

function cloneOrder(order: PaymentOrder): PaymentOrder {
  return {
    ...order,
    createdAt: new Date(order.createdAt),
    paidAt: order.paidAt ? new Date(order.paidAt) : undefined,
    closedAt: order.closedAt ? new Date(order.closedAt) : undefined,
    refundedAt: order.refundedAt ? new Date(order.refundedAt) : undefined,
  };
}
