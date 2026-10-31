import { err, ok, type Result } from "../../../shared/result";

export type QuantityError = "INVALID_QUANTITY";

/** Number of tickets in a single order, bounded by MAX_TICKETS_PER_ORDER. */
export class Quantity {
  private constructor(readonly value: number) {}

  static of(value: number, max: number): Result<Quantity, QuantityError> {

    const valid: boolean = Number.isInteger(value) && value >= 1 && value <= max;

    return valid ? ok(new Quantity(value)) : err("INVALID_QUANTITY");
  }
}
