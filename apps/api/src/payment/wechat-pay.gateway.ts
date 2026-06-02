import type { WxCallbackHeaders, WxJsapiPayParams } from '@tizhice/shared';

export interface WechatPrepayInput {
  orderId: string;
  userId: string;
  reportId: string;
  amount: number;
}

export interface VerifiedWechatCallback {
  orderId: string;
  transactionId: string;
  paidAt: Date;
  nonce: string;
}

export interface WechatPayGateway {
  createJsapiParams(input: WechatPrepayInput): Promise<{
    prepayId: string;
    jsapiParams: WxJsapiPayParams;
  }>;
  verifyCallback(
    rawBody: Buffer,
    headers: WxCallbackHeaders,
  ): Promise<VerifiedWechatCallback | null>;
  refund(input: { orderId: string; reason: string; amount: number }): Promise<{ refundId: string }>;
}

export class DeterministicWechatPayGateway implements WechatPayGateway {
  async createJsapiParams(input: WechatPrepayInput): Promise<{
    prepayId: string;
    jsapiParams: WxJsapiPayParams;
  }> {
    const prepayId = `prepay-${input.orderId}`;
    return {
      prepayId,
      jsapiParams: {
        appId: 'wx-test-app',
        timeStamp: '1780360000',
        nonceStr: `nonce-${input.orderId}`,
        package: `prepay_id=${prepayId}`,
        signType: 'RSA',
        paySign: `pay-sign-${input.orderId}`,
      },
    };
  }

  async verifyCallback(
    rawBody: Buffer,
    headers: WxCallbackHeaders,
  ): Promise<VerifiedWechatCallback | null> {
    if (headers['wechatpay-signature'] !== 'valid-signature') {
      return null;
    }
    const timestamp = Number(headers['wechatpay-timestamp']);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 5 * 60) {
      return null;
    }
    const payload = JSON.parse(rawBody.toString('utf8')) as {
      orderId: string;
      transactionId?: string;
      paidAt?: string;
    };
    return {
      orderId: payload.orderId,
      transactionId: payload.transactionId ?? `wx-${payload.orderId}`,
      paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),
      nonce: headers['wechatpay-nonce'],
    };
  }

  async refund(input: {
    orderId: string;
    reason: string;
    amount: number;
  }): Promise<{ refundId: string }> {
    return { refundId: `refund-${input.orderId}` };
  }
}
