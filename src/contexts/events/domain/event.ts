import { err, ok, type Result } from "../../../shared/result";
import type { Money } from "./money";
import { slugFromTitle } from "./slug";

export const EVENT_RULES = {
  titleMin: 3,
  titleMax: 120,
  descriptionMax: 2000,
  capacityMax: 100_000,
  /** Tickets can still be bought at the door for a while after the event starts. */
  salesAfterStartMinutes: 240,
} as const;

export type EventStatus = "draft" | "published" | "closed";

export type CreateEventError = "INVALID_TITLE" | "INVALID_DESCRIPTION" | "STARTS_IN_THE_PAST" | "INVALID_CAPACITY" | "INVALID_PRICE";

export type PublishEventError = "EVENT_NOT_DRAFT";

export type CloseEventError = "EVENT_ALREADY_CLOSED";

export interface CreateEventInput {
  readonly title: string;
  readonly description: string;
  readonly startsAt: Date;
  readonly price: Money;
  readonly capacity: number;
  readonly bannerKey: string | null;
}

export interface CreateEventContext {
  readonly id: string;
  readonly slugSuffix: string;
  readonly now: Date;
}

export interface EventSnapshot {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly startsAt: Date;
  readonly price: Money;
  readonly capacity: number;
  readonly sold: number;
  readonly status: EventStatus;
  readonly bannerKey: string | null;
  readonly createdAt: Date;
}

/** Event aggregate (catalog). Immutable: every transition returns a new instance. */
export class Event {
  private constructor(private readonly props: EventSnapshot) {}

  static create(input: CreateEventInput, context: CreateEventContext): Result<Event, CreateEventError> {

    const validationError: CreateEventError | null = validateCreateInput(input, context.now);

    if (validationError) {
      return err(validationError);
    }

    const title: string = input.title.trim();

    return ok(
      new Event({
        id: context.id,
        slug: slugFromTitle(title, context.slugSuffix),
        title,
        description: input.description.trim(),
        startsAt: input.startsAt,
        price: input.price,
        capacity: input.capacity,
        sold: 0,
        status: "draft",
        bannerKey: input.bannerKey,
        createdAt: context.now,
      }),
    );
  }

  static restore(snapshot: EventSnapshot): Event {
    return new Event(snapshot);
  }

  get id(): string {
    return this.props.id;
  }

  get slug(): string {
    return this.props.slug;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string {
    return this.props.description;
  }

  get startsAt(): Date {
    return this.props.startsAt;
  }

  get price(): Money {
    return this.props.price;
  }

  get capacity(): number {
    return this.props.capacity;
  }

  get sold(): number {
    return this.props.sold;
  }

  get status(): EventStatus {
    return this.props.status;
  }

  get bannerKey(): string | null {
    return this.props.bannerKey;
  }

  get remaining(): number {
    return Math.max(0, this.props.capacity - this.props.sold);
  }

  hasSeatsFor(quantity: number): boolean {
    return this.remaining >= quantity;
  }

  isOnSale(now: Date): boolean {

    const salesCutoff: number = this.props.startsAt.getTime() + EVENT_RULES.salesAfterStartMinutes * 60_000;

    return this.props.status === "published" && now.getTime() < salesCutoff;
  }

  publish(): Result<Event, PublishEventError> {

    if (this.props.status !== "draft") {
      return err("EVENT_NOT_DRAFT");
    }

    return ok(new Event({ ...this.props, status: "published" }));
  }

  close(): Result<Event, CloseEventError> {

    if (this.props.status === "closed") {
      return err("EVENT_ALREADY_CLOSED");
    }

    return ok(new Event({ ...this.props, status: "closed" }));
  }

  toSnapshot(): EventSnapshot {
    return this.props;
  }
}

function validateCreateInput(input: CreateEventInput, now: Date): CreateEventError | null {

  const titleLength: number = input.title.trim().length;

  if (titleLength < EVENT_RULES.titleMin || titleLength > EVENT_RULES.titleMax) {
    return "INVALID_TITLE";
  }

  if (input.description.length > EVENT_RULES.descriptionMax) {
    return "INVALID_DESCRIPTION";
  }

  const startsAtMs: number = input.startsAt.getTime();

  if (Number.isNaN(startsAtMs) || startsAtMs <= now.getTime()) {
    return "STARTS_IN_THE_PAST";
  }

  const validCapacity: boolean = Number.isInteger(input.capacity) && input.capacity > 0 && input.capacity <= EVENT_RULES.capacityMax;

  if (!validCapacity) {
    return "INVALID_CAPACITY";
  }

  return input.price.isZero() ? "INVALID_PRICE" : null;
}
