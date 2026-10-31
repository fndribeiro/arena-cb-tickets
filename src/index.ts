import type { Bindings } from "./bindings";
import { processPendingOrders } from "./contexts/sales/application/process-pending-orders";
import { createApp } from "./interface/http/app";
import { buildContainer } from "./interface/http/container";
import { createLogger, describeError } from "./shared/logger";

const app = createApp();

export default {
  fetch: app.fetch,

  /** Cron Trigger: reconcile pending Pix orders with the gateway and release expired reservations. */
  async scheduled(controller: ScheduledController, env: Bindings, ctx: ExecutionContext): Promise<void> {

    const logger = createLogger({ job: "process-pending-orders", cron: controller.cron });

    const run = async (): Promise<void> => {

      try {
        const container = buildContainer(env, logger);

        await processPendingOrders(container.processPending);
      } catch (error) {
        logger.error("scheduled job failed", describeError(error));
        throw error;
      }
    };

    ctx.waitUntil(run());
  },
} satisfies ExportedHandler<Bindings>;
