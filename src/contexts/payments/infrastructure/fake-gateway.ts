import { err, type Result } from "../../../shared/result";
import type { ChargeStatus, CreatePixChargeInput, PaymentGateway, PixCharge, WebhookError } from "../domain/payment-gateway";

const FAKE_PIX_PREFIX = "00020126580014br.gov.bcb.pix0136arena-cb-tickets-fake-charge";

/**
 * Local/CI gateway: always test mode, charges stay pending until the "simulate payment" action confirms the order.
 * Config validation forbids it when PAYMENT_TEST_MODE=false.
 */
export class FakePaymentGateway implements PaymentGateway {
  readonly name = "fake";

  readonly testMode = true;

  async createPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {
    return { chargeId: `fake_${input.orderId}`, qrCode: `${FAKE_PIX_PREFIX}${input.orderId}5204000053039865406${input.amount.toDecimalString()}`, qrCodeBase64: null, ticketUrl: null };
  }

  async getChargeStatus(_chargeId: string): Promise<ChargeStatus> {
    return "pending";
  }

  async parseWebhook(): Promise<Result<{ readonly chargeId: string }, WebhookError>> {
    return err("IGNORED_EVENT");
  }
}
