import type { Bindings } from "../../bindings";
import { type AppConfig, loadConfig } from "../../config";
import type { ManageEventsDeps } from "../../contexts/events/application/manage-events";
import type { EventRepository } from "../../contexts/events/domain/event-repository";
import { D1EventRepository } from "../../contexts/events/infrastructure/d1-event-repository";
import type { SignInDeps } from "../../contexts/identity/application/sign-in-with-google";
import { AdminPolicy } from "../../contexts/identity/domain/admin-policy";
import { D1UserRepository } from "../../contexts/identity/infrastructure/d1-user-repository";
import { GoogleIdTokenVerifier } from "../../contexts/identity/infrastructure/google-token-verifier";
import type { PaymentGateway } from "../../contexts/payments/domain/payment-gateway";
import { FakePaymentGateway } from "../../contexts/payments/infrastructure/fake-gateway";
import { MercadoPagoGateway } from "../../contexts/payments/infrastructure/mercado-pago-gateway";
import type { ConfirmPaymentDeps } from "../../contexts/sales/application/confirm-payment";
import type { PlaceOrderDeps } from "../../contexts/sales/application/place-order";
import type { ProcessPendingOrdersDeps } from "../../contexts/sales/application/process-pending-orders";
import type { OrderRepository } from "../../contexts/sales/domain/order-repository";
import { D1OrderRepository } from "../../contexts/sales/infrastructure/d1-order-repository";
import type { CheckInDeps } from "../../contexts/ticketing/application/check-in";
import { type IssueTicketsDeps, issueTickets } from "../../contexts/ticketing/application/issue-tickets";
import type { TicketQueries } from "../../contexts/ticketing/application/ticket-queries";
import { D1TicketQueries } from "../../contexts/ticketing/infrastructure/d1-ticket-queries";
import { D1TicketRepository } from "../../contexts/ticketing/infrastructure/d1-ticket-repository";
import { createDatabase } from "../../db/client";
import { type Clock, systemClock } from "../../shared/clock";
import { newId, randomToken } from "../../shared/ids";
import type { Logger } from "../../shared/logger";

const SLUG_SUFFIX_BYTES = 3;

const PENDING_BATCH_SIZE = 50;

/** Composition root: wires adapters into use-case dependencies. Cheap to build per request (stateless workers). */
export interface Container {
  readonly config: AppConfig;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly gateway: PaymentGateway;
  readonly adminPolicy: AdminPolicy;
  readonly events: EventRepository;
  readonly orders: OrderRepository;
  readonly ticketQueries: TicketQueries;
  readonly banners: R2Bucket;
  readonly manageEvents: ManageEventsDeps;
  readonly placeOrder: PlaceOrderDeps;
  readonly confirmPayment: ConfirmPaymentDeps;
  readonly processPending: ProcessPendingOrdersDeps;
  readonly checkIn: CheckInDeps;
  readonly signIn: SignInDeps;
}

export function buildContainer(env: Bindings, logger: Logger): Container {

  const config: AppConfig = loadConfig(env);

  const db = createDatabase(env.DB);

  const clock: Clock = systemClock;

  const events = new D1EventRepository(db);

  const orders = new D1OrderRepository(db);

  const tickets = new D1TicketRepository(db);

  const users = new D1UserRepository(db);

  const gateway: PaymentGateway = buildGateway(config, logger);

  const adminPolicy: AdminPolicy = AdminPolicy.fromList(config.adminEmails);

  const issueDeps: IssueTicketsDeps = { tickets, clock, logger, newId, newCode: randomToken };

  const confirmPayment: ConfirmPaymentDeps = { orders, gateway, clock, logger, onOrderPaid: (event) => issueTickets(event, issueDeps).then(() => undefined) };

  return {
    config,
    clock,
    logger,
    gateway,
    adminPolicy,
    events,
    orders,
    ticketQueries: new D1TicketQueries(db),
    banners: env.BANNERS,
    manageEvents: { events, clock, logger, newId, newSlugSuffix: () => randomToken(SLUG_SUFFIX_BYTES).toLowerCase() },
    placeOrder: { events, orders, gateway, clock, logger, newId, ttlMinutes: config.orderTtlMinutes, maxTicketsPerOrder: config.maxTicketsPerOrder },
    confirmPayment,
    processPending: { ...confirmPayment, events, batchSize: PENDING_BATCH_SIZE },
    checkIn: { tickets, clock, logger },
    signIn: { verifier: new GoogleIdTokenVerifier({ clientId: config.googleClientId, logger }), users, adminPolicy, logger },
  };
}

function buildGateway(config: AppConfig, logger: Logger): PaymentGateway {

  const { payment } = config;

  if (payment.gateway === "fake") {
    return new FakePaymentGateway();
  }

  return new MercadoPagoGateway({
    accessToken: payment.mercadoPagoAccessToken ?? "",
    webhookSecret: payment.mercadoPagoWebhookSecret ?? "",
    testMode: payment.testMode,
    logger,
  });
}
