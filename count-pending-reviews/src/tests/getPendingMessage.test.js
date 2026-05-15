const { getPendingMessage } = require("../approval");

describe("getPendingMessage", () => {
  describe("needs codeowner and extra approvals", () => {
    test("all zero with minTotal=2: needs 1 lead and 1 more", () => {
      expect(getPendingMessage({ maintainer: 0, teamLead: 0, other: 0 }, 2)).toBe(
        "1 Management or Team Lead, and 1 more from Management, Team Lead, or Member",
      );
    });

    test("all zero with minTotal=3: needs 1 lead and 2 more", () => {
      expect(getPendingMessage({ maintainer: 0, teamLead: 0, other: 0 }, 3)).toBe(
        "1 Management or Team Lead, and 2 more from Management, Team Lead, or Member",
      );
    });

    test("1 member with minTotal=3: needs 1 lead and 1 more (member partially fills total)", () => {
      expect(getPendingMessage({ maintainer: 0, teamLead: 0, other: 1 }, 3)).toBe(
        "1 Management or Team Lead, and 1 more from Management, Team Lead, or Member",
      );
    });
  });

  describe("needs codeowner only (total already met by members)", () => {
    test("2 members with minTotal=2: total is met but no lead approval", () => {
      expect(getPendingMessage({ maintainer: 0, teamLead: 0, other: 2 }, 2)).toBe(
        "1 Management or Team Lead",
      );
    });

    test("3 members with minTotal=3: total is met but no lead approval", () => {
      expect(getPendingMessage({ maintainer: 0, teamLead: 0, other: 3 }, 3)).toBe(
        "1 Management or Team Lead",
      );
    });

    test("1 member with minTotal=2: codeowner satisfies the remaining total deficit too", () => {
      expect(getPendingMessage({ maintainer: 0, teamLead: 0, other: 1 }, 2)).toBe(
        "1 Management or Team Lead",
      );
    });
  });

  describe("needs extra approvals only (codeowner already met)", () => {
    test("1 management with minTotal=2: 1 more from any role", () => {
      expect(getPendingMessage({ maintainer: 1, teamLead: 0, other: 0 }, 2)).toBe(
        "1 more from Management, Team Lead, or Member",
      );
    });

    test("1 team lead with minTotal=2: 1 more from any role", () => {
      expect(getPendingMessage({ maintainer: 0, teamLead: 1, other: 0 }, 2)).toBe(
        "1 more from Management, Team Lead, or Member",
      );
    });

    test("1 management with minTotal=3: 2 more from any role", () => {
      expect(getPendingMessage({ maintainer: 1, teamLead: 0, other: 0 }, 3)).toBe(
        "2 more from Management, Team Lead, or Member",
      );
    });

    test("1 team lead + 1 member with minTotal=3: 1 more from any role", () => {
      expect(getPendingMessage({ maintainer: 0, teamLead: 1, other: 1 }, 3)).toBe(
        "1 more from Management, Team Lead, or Member",
      );
    });

    test("1 management + 1 member with minTotal=3: 1 more from any role", () => {
      expect(getPendingMessage({ maintainer: 1, teamLead: 0, other: 1 }, 3)).toBe(
        "1 more from Management, Team Lead, or Member",
      );
    });
  });
});
