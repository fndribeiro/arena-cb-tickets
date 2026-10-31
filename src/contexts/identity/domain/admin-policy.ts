import { Email } from "./email";
import type { Role } from "./role";

/** Admins are configured by email (ADMIN_EMAILS); every other Google account is a regular user. */
export class AdminPolicy {
  private constructor(private readonly adminEmails: ReadonlySet<string>) {}

  static fromList(commaSeparated: string): AdminPolicy {

    const parsed = commaSeparated.split(",").map((candidate) => Email.parse(candidate));

    const emails: ReadonlyArray<string> = parsed.flatMap((result) => (result.ok ? [result.value.value] : []));

    return new AdminPolicy(new Set(emails));
  }

  roleFor(email: string): Role {

    const parsed = Email.parse(email);

    return parsed.ok && this.adminEmails.has(parsed.value.value) ? "admin" : "user";
  }
}
