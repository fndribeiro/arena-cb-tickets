import { describe, expect, it } from "vitest";
import { AdminPolicy } from "../../../src/contexts/identity/domain/admin-policy";
import { Email } from "../../../src/contexts/identity/domain/email";

describe("Email", () => {
  it("normalizes case and whitespace", () => {

    const result = Email.parse("  Fulano@Gmail.COM ");

    expect(result.ok && result.value.value).toBe("fulano@gmail.com");
  });

  it.each(["", "no-at-sign", "a@b", "@domain.com", "a b@c.com", `${"x".repeat(250)}@c.com`])("rejects %s", (input) => {

    expect(Email.parse(input).ok).toBe(false);
  });
});

describe("AdminPolicy", () => {
  const policy = AdminPolicy.fromList(" Admin@Arena.test , other@arena.test,,invalid ");

  it("grants admin to listed emails regardless of case", () => {

    expect(policy.roleFor("admin@arena.test")).toBe("admin");

    expect(policy.roleFor("OTHER@arena.test")).toBe("admin");
  });

  it("treats everyone else as a regular user", () => {

    expect(policy.roleFor("buyer@gmail.com")).toBe("user");

    expect(policy.roleFor("invalid")).toBe("user");
  });
});
