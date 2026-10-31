import type { Logger } from "../../../shared/logger";
import { err, ok, type Result } from "../../../shared/result";
import type { AdminPolicy } from "../domain/admin-policy";
import { Email } from "../domain/email";
import type { Role } from "../domain/role";
import type { User } from "../domain/user";
import type { UserRepository } from "../domain/user-repository";

export interface GoogleIdentity {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name: string;
  readonly picture: string | null;
}

export interface GoogleTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity | null>;
}

export interface SignInDeps {
  readonly verifier: GoogleTokenVerifier;
  readonly users: UserRepository;
  readonly adminPolicy: AdminPolicy;
  readonly logger: Logger;
}

export interface SignedInUser {
  readonly user: User;
  readonly role: Role;
}

export type SignInError = "INVALID_TOKEN" | "EMAIL_NOT_VERIFIED";

const MAX_NAME_LENGTH = 120;

/** Google is the only identity provider: no passwords are stored by this system. */
export async function signInWithGoogle(idToken: string, deps: SignInDeps): Promise<Result<SignedInUser, SignInError>> {

  const identity: GoogleIdentity | null = await deps.verifier.verify(idToken);

  const email = identity ? Email.parse(identity.email) : null;

  if (!identity || !email?.ok) {
    deps.logger.warn("google sign-in rejected: invalid token");
    return err("INVALID_TOKEN");
  }

  if (!identity.emailVerified) {
    deps.logger.warn("google sign-in rejected: email not verified");
    return err("EMAIL_NOT_VERIFIED");
  }

  const name: string = identity.name.trim().slice(0, MAX_NAME_LENGTH) || email.value.value;

  const user: User = await deps.users.upsertByEmail({ email: email.value.value, name, picture: identity.picture });

  const role: Role = deps.adminPolicy.roleFor(user.email);

  deps.logger.info("user signed in", { userId: user.id, role });

  return ok({ user, role });
}
