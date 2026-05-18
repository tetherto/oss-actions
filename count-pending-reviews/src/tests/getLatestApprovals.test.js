const { getLatestApprovals } = require("../approval");

describe("getLatestApprovals", () => {
  test("returns empty object for no reviews", () => {
    expect(getLatestApprovals([])).toEqual({});
  });

  test("keeps the latest review when a user has reviewed multiple times", () => {
    const reviews = [
      { user: { login: "alice" }, submitted_at: "2024-01-01T10:00:00Z", state: "CHANGES_REQUESTED" },
      { user: { login: "alice" }, submitted_at: "2024-01-02T10:00:00Z", state: "APPROVED" },
    ];
    expect(getLatestApprovals(reviews)["alice"].state).toBe("APPROVED");
  });

  test("does not overwrite with an older review", () => {
    const reviews = [
      { user: { login: "alice" }, submitted_at: "2024-01-02T10:00:00Z", state: "APPROVED" },
      { user: { login: "alice" }, submitted_at: "2024-01-01T10:00:00Z", state: "CHANGES_REQUESTED" },
    ];
    expect(getLatestApprovals(reviews)["alice"].state).toBe("APPROVED");
  });

  test("tracks multiple users independently", () => {
    const reviews = [
      { user: { login: "alice" }, submitted_at: "2024-01-01T10:00:00Z", state: "APPROVED" },
      { user: { login: "bob" },   submitted_at: "2024-01-01T10:00:00Z", state: "APPROVED" },
    ];
    const result = getLatestApprovals(reviews);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result["alice"]).toBeDefined();
    expect(result["bob"]).toBeDefined();
  });

  test("skips reviews with no user login", () => {
    const reviews = [
      { user: null,               submitted_at: "2024-01-01T10:00:00Z", state: "APPROVED" },
      { user: { login: "alice" }, submitted_at: "2024-01-01T10:00:00Z", state: "APPROVED" },
    ];
    expect(Object.keys(getLatestApprovals(reviews))).toEqual(["alice"]);
  });
});
