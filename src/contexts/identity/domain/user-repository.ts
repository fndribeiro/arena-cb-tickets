import type { User } from "./user";

export interface UpsertUserInput {
  readonly email: string;
  readonly name: string;
  readonly picture: string | null;
}

export interface UserRepository {
  upsertByEmail(input: UpsertUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
}
