import type { Context } from "hono";
import { completeAdminGuide } from "../../../contexts/identity/application/admin-guide";
import type { AppEnv, Viewer } from "../app-env";
import { AdminGuide, GUIDE_STEP_COUNT } from "../views/admin-guide";
import { Layout } from "../views/layout";

const FIRST_STEP = 1;

const NEXT_DESTINATIONS: Readonly<Record<string, string>> = { dashboard: "/admin" };

const DEFAULT_NEXT_DESTINATION = "/admin/events/new";

function currentAdmin(c: Context<AppEnv>): Viewer {

  const viewer = c.get("viewer");

  if (!viewer) {
    throw new Error("requireAdmin middleware must run before this handler");
  }

  return viewer;
}

/** Unknown, malformed or out-of-range steps fall back to the first one. */
export function parseGuideStep(raw: string | undefined): number {

  const step = Number(raw);

  const valid: boolean = Number.isInteger(step) && step >= FIRST_STEP && step <= GUIDE_STEP_COUNT;

  return valid ? step : FIRST_STEP;
}

export function renderAdminGuide(c: Context<AppEnv>) {

  const { config } = c.get("container");

  const step: number = parseGuideStep(c.req.query("step"));

  return c.html(
    <Layout title="Guia do administrador" viewer={c.get("viewer")} testMode={config.payment.testMode}>
      <AdminGuide step={step} orderTtlMinutes={config.orderTtlMinutes} testMode={config.payment.testMode} />
    </Layout>,
  );
}

export async function handleCompleteAdminGuide(c: Context<AppEnv>) {

  const form = await c.req.parseBody();

  await completeAdminGuide(currentAdmin(c).userId, c.get("container").adminGuide);

  const destination: string = NEXT_DESTINATIONS[String(form.next ?? "")] ?? DEFAULT_NEXT_DESTINATION;

  return c.redirect(destination);
}
