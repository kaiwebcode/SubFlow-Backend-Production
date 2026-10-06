import { describe, expect, it } from "vitest";

import { assertOwnership } from "./authorization.js";

describe("Authorization ownership", () => {
  const userA = "user-a";
  const userB = "user-b";

  it("allows a user to access their own resource", () => {
    expect(() => {
      assertOwnership(userA, userA);
    }).not.toThrow();
  });

  it("rejects another user's resource", () => {
    expect(() => {
      assertOwnership(userB, userA);
    }).toThrow("You do not have permission to access this resource");
  });

  it("throws FORBIDDEN for another user's resource", () => {
    try {
      assertOwnership(userB, userA);
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });
    }
  });
});