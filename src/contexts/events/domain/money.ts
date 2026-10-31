import { err, ok, type Result } from "../../../shared/result";

const MAX_CENTS = 100_000_000;

const BRL_INPUT_PATTERN = /^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/;

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export type MoneyError = "INVALID_AMOUNT";

/** Immutable amount of Brazilian reais stored as integer cents (never floats). */
export class Money {
  private constructor(readonly cents: number) {}

  static fromCents(cents: number): Result<Money, MoneyError> {

    const valid: boolean = Number.isInteger(cents) && cents >= 0 && cents <= MAX_CENTS;

    return valid ? ok(new Money(cents)) : err("INVALID_AMOUNT");
  }

  /** Parses user input such as "20", "20,50", "20.50" or "1.234,56". */
  static parseBrl(input: string): Result<Money, MoneyError> {

    const trimmed: string = input.trim();

    if (!BRL_INPUT_PATTERN.test(trimmed)) {
      return err("INVALID_AMOUNT");
    }

    const normalized: string = normalizeBrlDecimal(trimmed);

    const [reais = "0", fraction = ""] = normalized.split(".");

    const cents: number = Number(reais) * 100 + Number(fraction.padEnd(2, "0"));

    return Money.fromCents(cents);
  }

  /** Rehydrates a trusted persisted value; corrupted data is an unexpected failure. */
  static restore(cents: number): Money {

    const result = Money.fromCents(cents);

    if (!result.ok) {
      throw new Error(`Invalid persisted amount: ${cents}`);
    }

    return result.value;
  }

  multiply(quantity: number): Money {
    return Money.restore(this.cents * quantity);
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  toDecimalString(): string {
    return (this.cents / 100).toFixed(2);
  }

  format(): string {
    return BRL_FORMATTER.format(this.cents / 100);
  }
}

function normalizeBrlDecimal(value: string): string {

  const hasCommaDecimal: boolean = value.includes(",");

  if (hasCommaDecimal) {
    return value.replaceAll(".", "").replace(",", ".");
  }

  const isThousandsOnly: boolean = /^\d{1,3}(\.\d{3})+$/.test(value);

  return isThousandsOnly ? value.replaceAll(".", "") : value;
}
