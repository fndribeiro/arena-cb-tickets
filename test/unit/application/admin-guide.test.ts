import { describe, expect, it } from "vitest";
import { type AdminGuideDeps, completeAdminGuide, shouldShowAdminGuide } from "../../../src/contexts/identity/application/admin-guide";
import { FixedClock, InMemoryUserRepository, RecordingLogger } from "../../support/in-memory";

const NOW = new Date("2026-11-01T15:00:00Z");

function guideDeps(): AdminGuideDeps & { users: InMemoryUserRepository; logger: RecordingLogger } {
  return { users: new InMemoryUserRepository(), clock: new FixedClock(NOW), logger: new RecordingLogger() };
}

describe("admin guide", () => {
  it("is shown to an admin who has not completed it yet", async () => {

    const deps = guideDeps();

    expect(await shouldShowAdminGuide({ userId: "usr-1", role: "admin" }, deps)).toBe(true);
  });

  it("is never shown to regular users and does not query storage for them", async () => {

    const deps = guideDeps();

    deps.users.findAdminGuideCompletedAt = async () => {
      throw new Error("must not be called for regular users");
    };

    expect(await shouldShowAdminGuide({ userId: "usr-1", role: "user" }, deps)).toBe(false);
  });

  it("is not shown again after completion", async () => {

    const deps = guideDeps();

    await completeAdminGuide("usr-1", deps);

    expect(await shouldShowAdminGuide({ userId: "usr-1", role: "admin" }, deps)).toBe(false);

    expect(deps.users.guideCompletions.get("usr-1")).toEqual(NOW);
  });

  it("completing twice keeps the first completion date and logs it", async () => {

    const deps = guideDeps();

    await completeAdminGuide("usr-1", deps);

    (deps.clock as FixedClock).set(new Date("2026-11-02T10:00:00Z"));

    await completeAdminGuide("usr-1", deps);

    expect(deps.users.guideCompletions.get("usr-1")).toEqual(NOW);

    expect(deps.logger.has("info", "admin guide completed")).toBe(true);

    expect(deps.logger.has("info", "admin guide already completed")).toBe(true);
  });
});
