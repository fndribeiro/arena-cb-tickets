import { createMiddleware } from "hono/factory";
import { newId } from "../../../shared/ids";
import { createLogger } from "../../../shared/logger";
import type { AppEnv } from "../app-env";
import { buildContainer } from "../container";

/** Adds a request id, a correlated logger and the composition root to every request. */
export const requestContext = createMiddleware<AppEnv>(async (c, next) => {

  const requestId: string = c.req.header("cf-ray") ?? newId();

  const logger = createLogger({ requestId, method: c.req.method, path: c.req.path });

  c.set("requestId", requestId);

  c.set("logger", logger);

  c.set("container", buildContainer(c.env, logger));

  const startedAt: number = Date.now();

  await next();

  logger.info("request completed", { status: c.res.status, durationMs: Date.now() - startedAt });
});
