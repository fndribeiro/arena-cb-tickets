import type { Clock } from "../../../shared/clock";
import type { Logger } from "../../../shared/logger";
import { err, ok, type Result } from "../../../shared/result";
import { type CloseEventError, type CreateEventError, type CreateEventInput, Event, type PublishEventError } from "../domain/event";
import type { EventRepository } from "../domain/event-repository";

export interface ManageEventsDeps {
  readonly events: EventRepository;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly newId: () => string;
  readonly newSlugSuffix: () => string;
}

export type EventNotFound = "EVENT_NOT_FOUND";

export async function createEvent(input: CreateEventInput, deps: ManageEventsDeps): Promise<Result<Event, CreateEventError>> {

  const context = { id: deps.newId(), slugSuffix: deps.newSlugSuffix(), now: deps.clock.now() };

  const created = Event.create(input, context);

  if (!created.ok) {
    deps.logger.warn("event creation rejected", { reason: created.error, title: input.title });
    return created;
  }

  await deps.events.insert(created.value);

  deps.logger.info("event created", { eventId: created.value.id, slug: created.value.slug, capacity: input.capacity });

  return created;
}

export async function publishEvent(eventId: string, deps: ManageEventsDeps): Promise<Result<Event, PublishEventError | EventNotFound>> {

  const event: Event | null = await deps.events.findById(eventId);

  if (!event) {
    return err("EVENT_NOT_FOUND");
  }

  const published = event.publish();

  if (!published.ok) {
    deps.logger.warn("event publish rejected", { eventId, reason: published.error, status: event.status });
    return published;
  }

  await deps.events.updateStatus(published.value);

  deps.logger.info("event published", { eventId });

  return ok(published.value);
}

export async function closeEvent(eventId: string, deps: ManageEventsDeps): Promise<Result<Event, CloseEventError | EventNotFound>> {

  const event: Event | null = await deps.events.findById(eventId);

  if (!event) {
    return err("EVENT_NOT_FOUND");
  }

  const closed = event.close();

  if (!closed.ok) {
    deps.logger.warn("event close rejected", { eventId, reason: closed.error });
    return closed;
  }

  await deps.events.updateStatus(closed.value);

  deps.logger.info("event closed", { eventId, sold: event.sold, capacity: event.capacity });

  return ok(closed.value);
}
