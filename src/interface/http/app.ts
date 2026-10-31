import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { describeError } from "../../shared/logger";
import type { AppEnv } from "./app-env";
import { requestContext } from "./middleware/context";
import { requireSameOrigin } from "./middleware/guards";
import { loadViewer } from "./middleware/session";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { orderRoutes } from "./routes/orders";
import { publicRoutes } from "./routes/public";
import { webhookRoutes } from "./routes/webhooks";

const GOOGLE_GSI = "https://accounts.google.com/gsi/";

export function createApp(): Hono<AppEnv> {

  const app = new Hono<AppEnv>();

  app.use(
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", `${GOOGLE_GSI}client`],
        styleSrc: ["'self'", "'unsafe-inline'", `${GOOGLE_GSI}style`],
        frameSrc: [GOOGLE_GSI],
        connectSrc: ["'self'", GOOGLE_GSI],
        imgSrc: ["'self'", "data:", "https://*.googleusercontent.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
      crossOriginOpenerPolicy: "same-origin-allow-popups",
      // "no-referrer" (Hono default) makes browsers send `Origin: null` on same-origin form posts, breaking the Origin check.
      referrerPolicy: "strict-origin-when-cross-origin",
    }),
  );

  // Webhooks are server-to-server: no session, no Origin header.
  app.route("/", webhookRoutesWithContext());

  app.use(requestContext, loadViewer, requireSameOrigin);

  app.route("/", publicRoutes);

  app.route("/", authRoutes);

  app.route("/", orderRoutes);

  app.route("/", adminRoutes);

  app.notFound((c) => c.text("Página não encontrada", 404));

  app.onError((error, c) => {

    const logger = c.get("logger");

    if (logger) {
      logger.error("unhandled error", describeError(error));
    } else {
      console.error(JSON.stringify({ level: "error", message: "unhandled error before context", ...describeError(error) }));
    }

    return c.text("Erro interno. Tente novamente.", 500);
  });

  return app;
}

function webhookRoutesWithContext(): Hono<AppEnv> {

  const scoped = new Hono<AppEnv>();

  scoped.use("/webhooks/*", requestContext);

  scoped.route("/", webhookRoutes);

  return scoped;
}
