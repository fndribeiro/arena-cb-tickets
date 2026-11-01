import type { User } from "./user";

export interface UpsertUserInput {
  readonly email: string;
  readonly name: string;
  readonly picture: string | null;
}

export interface UserRepository {
  upsertByEmail(input: UpsertUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findAdminGuideCompletedAt(userId: string): Promise<Date | null>;
  /** Stores the first completion only; returns false when it was already completed. */
  markAdminGuideCompleted(userId: string, completedAt: Date): Promise<boolean>;
}
