import { describe, expect, it } from "vitest";
import { formatDateTime, parseLocalDateTime } from "../../src/shared/time";

describe("time helpers", () => {
  it("interprets datetime-local input as São Paulo time", () => {

    expect(parseLocalDateTime("2026-11-06T20:00")?.toISOString()).toBe("2026-11-06T23:00:00.000Z");
  });

  it.each(["", "2026-11-06", "2026-13-40T99:99", "20:00", "2026-11-06T20:00:00Z"])("rejects malformed input %s", (value) => {

    expect(parseLocalDateTime(value)).toBeNull();
  });

  it("formats in São Paulo time", () => {

    expect(formatDateTime(new Date("2026-11-06T23:00:00Z"))).toContain("20:00");
  });
});
