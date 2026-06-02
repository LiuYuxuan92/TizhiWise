/**
 * 支付服务跨服务 DTO（R6）。
 * 对应 design.md 3.4 PaymentService。
 */
import type { Currency, OrderStatus } from '../enums.js';

/** 支付订单。 */
export interface PaymentOrder {
  /** 商户订单号（全局唯一）。 */
  id: string;
  userId: string;
  /** 关联的报告。 */
  reportId: string;
  /** 金额，单位：分。 */
  amount: number;
  currency: Currency;
  status: OrderStatus;
  wxPrepayId?: string;
  wxTransactionId?: string;
  createdAt: Date;
  paidAt?: Date;
  closedAt?: Date;
  refundedAt?: Date;
  refundOperator?: string;
  /** 前端生成，防重复下单。 */
  idempotencyKey: string;
  /** 回调签名校验结果。 */
  callbackVerified: boolean;
  /** 是否已对账。 */
  reconciled: boolean;
}

/** 前端调起微信 JSAPI 支付所需参数。 */
export interface WxJsapiPayParams {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  /** 形如 "prepay_id=xxxx"。 */
  package: string;
  signType: 'RSA';
  paySign: string;
}

/** 微信支付回调请求头（用于验签）。 */
export interface WxCallbackHeaders {
  'wechatpay-timestamp': string;
  'wechatpay-nonce': string;
  'wechatpay-signature': string;
  'wechatpay-serial': string;
}

/* ───────────────────────── 请求 / 响应 DTO ───────────────────────── */

/** 创建订单入参。 */
export interface CreateOrderInput {
  userId: string;
  reportId: string;
  idempotencyKey: string;
}

/** 创建订单出参。 */
export interface CreateOrderResult {
  orderId: string;
  jsapiParams: WxJsapiPayParams;
}

/** 退款入参。 */
export interface RefundInput {
  orderId: string;
  reason: string;
  /** 管理员标识。 */
  operator: string;
}

/** 退款出参。 */
export interface RefundResult {
  refundId: string;
}
