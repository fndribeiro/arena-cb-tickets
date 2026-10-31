import { describe, expect, it } from "vitest";
import { Money } from "../../../src/contexts/events/domain/money";

describe("Money", () => {
  it("creates from integer cents", () => {

    const result = Money.fromCents(2000);

    expect(result.ok && result.value.cents).toBe(2000);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 100_000_001])("rejects invalid cents %s", (cents) => {

    const result = Money.fromCents(cents);

    expect(result).toEqual({ ok: false, error: "INVALID_AMOUNT" });
  });

  it.each([
    ["20", 2000],
    ["20,5", 2050],
    ["20.50", 2050],
    ["1.234,56", 123456],
    [" 15,00 ", 1500],
  ])("parses BRL input %s", (input, cents) => {

    const result = Money.parseBrl(input);

    expect(result.ok && result.value.cents).toBe(cents);
  });

  it.each(["", "abc", "20,555", "-5", "1e3"])("rejects malformed BRL input %s", (input) => {

    expect(Money.parseBrl(input).ok).toBe(false);
  });

  it("multiplies by quantity without floating point errors", () => {

    const unit = Money.restore(1990);

    expect(unit.multiply(3).cents).toBe(5970);
  });

  it("formats as decimal string and as BRL currency", () => {

    const money = Money.restore(123456);

    expect(money.toDecimalString()).toBe("1234.56");

    expect(money.format()).toMatch(/R\$\s?1\.234,56/);
  });

  it("restore throws on corrupted persisted values", () => {

    expect(() => Money.restore(-10)).toThrow(/Invalid persisted amount/);
  });
});
