import { env } from "cloudflare:test";
import { Event } from "../../src/contexts/events/domain/event";
import { Money } from "../../src/contexts/events/domain/money";
import { D1EventRepository } from "../../src/contexts/events/infrastructure/d1-event-repository";
import type { User } from "../../src/contexts/identity/domain/user";
import { D1UserRepository } from "../../src/contexts/identity/infrastructure/d1-user-repository";
import { createDatabase, type Database } from "../../src/db/client";
import { newId } from "../../src/shared/ids";

export function testDatabase(): Database {
  return createDatabase(env.DB);
}

export interface PublishedEventOptions {
  readonly capacity?: number;
  readonly priceCents?: number;
  readonly startsAt?: Date;
  readonly title?: string;
}

export async function insertPublishedEvent(db: Database, options: PublishedEventOptions = {}): Promise<Event> {

  const created = Event.create(
    {
      title: options.title ?? "Sertanejo Sexta",
      description: "Música ao vivo",
      startsAt: options.startsAt ?? new Date(Date.now() + 7 * 86_400_000),
      price: Money.restore(options.priceCents ?? 2000),
      capacity: options.capacity ?? 5,
      bannerKey: null,
    },
    { id: newId(), slugSuffix: newId().slice(0, 4), now: new Date() },
  );

  const published = created.ok ? created.value.publish() : null;

  if (!published?.ok) {
    throw new Error("fixture event could not be created");
  }

  const repository = new D1EventRepository(db);

  await repository.insert(published.value);

  return published.value;
}

export async function insertUser(db: Database, email: string = `${newId()}@gmail.com`): Promise<User> {
  return new D1UserRepository(db).upsertByEmail({ email, name: "Comprador Teste", picture: null });
}
