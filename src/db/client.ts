import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = DrizzleD1Database<typeof schema>;

export function createDatabase(d1: D1Database): Database {
  return drizzle(d1, { schema });
}

export function toIso(date: Date): string {
  return date.toISOString();
}

export function fromIso(value: string): Date {
  return new Date(value);
}

export function fromNullableIso(value: string | null): Date | null {
  return value ? new Date(value) : null;
}
