import { and, eq, isNull } from "drizzle-orm";
import { type Database, fromNullableIso, toIso } from "../../../db/client";
import { users } from "../../../db/schema";
import { newId } from "../../../shared/ids";
import type { User } from "../domain/user";
import type { UpsertUserInput, UserRepository } from "../domain/user-repository";

const USER_COLUMNS = { id: users.id, email: users.email, name: users.name, picture: users.picture };

export class D1UserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async upsertByEmail(input: UpsertUserInput): Promise<User> {

    const now: string = new Date().toISOString();

    const rows: User[] = await this.db
      .insert(users)
      .values({ id: newId(), email: input.email, name: input.name, picture: input.picture, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: users.email, set: { name: input.name, picture: input.picture, updatedAt: now } })
      .returning(USER_COLUMNS);

    const user: User | undefined = rows[0];

    if (!user) {
      throw new Error(`User upsert returned no row for ${input.email}`);
    }

    return user;
  }

  async findById(id: string): Promise<User | null> {

    const rows: User[] = await this.db.select(USER_COLUMNS).from(users).where(eq(users.id, id)).limit(1);

    return rows[0] ?? null;
  }

  async findAdminGuideCompletedAt(userId: string): Promise<Date | null> {

    const rows = await this.db.select({ completedAt: users.adminGuideCompletedAt }).from(users).where(eq(users.id, userId)).limit(1);

    return fromNullableIso(rows[0]?.completedAt ?? null);
  }

  async markAdminGuideCompleted(userId: string, completedAt: Date): Promise<boolean> {

    const notCompletedYet = and(eq(users.id, userId), isNull(users.adminGuideCompletedAt));

    const result = await this.db.update(users).set({ adminGuideCompletedAt: toIso(completedAt) }).where(notCompletedYet).run();

    return result.meta.changes === 1;
  }
}
