import { err, ok, type Result } from "../../../shared/result";

const MAX_LENGTH = 254;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailError = "INVALID_EMAIL";

export class Email {
  private constructor(readonly value: string) {}

  static parse(input: string): Result<Email, EmailError> {

    const normalized: string = input.trim().toLowerCase();

    const valid: boolean = normalized.length <= MAX_LENGTH && EMAIL_PATTERN.test(normalized);

    return valid ? ok(new Email(normalized)) : err("INVALID_EMAIL");
  }
}
