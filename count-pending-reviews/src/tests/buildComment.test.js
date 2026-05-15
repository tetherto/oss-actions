const { buildComment } = require("../approval");

describe("buildComment", () => {
  test("starts with the Review Status header", () => {
    const body = buildComment(true, { maintainer: 1, teamLead: 1, other: 0 }, "");
    expect(body.startsWith("## Review Status")).toBe(true);
  });

  test("approved: shows APPROVED, no pending section", () => {
    const body = buildComment(true, { maintainer: 1, teamLead: 1, other: 0 }, "");
    expect(body).toContain("✅ APPROVED");
    expect(body).not.toContain("❌ PENDING");
    expect(body).not.toContain("Pending reviews");
  });

  test("pending: shows PENDING and the pending message", () => {
    const msg  = "1 Management or Team Lead";
    const body = buildComment(false, { maintainer: 0, teamLead: 0, other: 0 }, msg);
    expect(body).toContain("❌ PENDING");
    expect(body).toContain("Pending reviews");
    expect(body).toContain(msg);
  });

  test("approval summary shows all three roles", () => {
    const body = buildComment(true, { maintainer: 1, teamLead: 2, other: 0 }, "");
    expect(body).toContain("Management 1");
    expect(body).toContain("Team Lead 2");
    expect(body).toContain("Member 0");
  });

  test("pending section ends with a period", () => {
    const body = buildComment(false, { maintainer: 0, teamLead: 0, other: 0 }, "1 Management or Team Lead");
    const pendingLine = body.split("\n").find((l) => l.includes("Pending reviews"));
    expect(pendingLine.trimEnd().endsWith(".")).toBe(true);
  });

  test("pending message is wrapped with 'Needs' prefix", () => {
    const msg  = "1 Management or Team Lead";
    const body = buildComment(false, { maintainer: 0, teamLead: 0, other: 0 }, msg);
    expect(body).toContain(`Needs ${msg}`);
  });

  test("all counts zero: summary still shows all three roles as 0", () => {
    const body = buildComment(false, { maintainer: 0, teamLead: 0, other: 0 }, "1 Management or Team Lead");
    expect(body).toContain("Management 0");
    expect(body).toContain("Team Lead 0");
    expect(body).toContain("Member 0");
  });

  test("summary roles are comma-separated", () => {
    const body = buildComment(true, { maintainer: 1, teamLead: 1, other: 1 }, "");
    const summaryLine = body.split("\n").find((l) => l.startsWith("Approvals so far:"));
    expect(summaryLine).toMatch(/Management \d+, Team Lead \d+, Member \d+/);
  });

  test("multi-part pending message renders in full", () => {
    const msg  = "1 Management or Team Lead, and 1 more from Management, Team Lead, or Member";
    const body = buildComment(false, { maintainer: 0, teamLead: 0, other: 0 }, msg);
    expect(body).toContain(msg);
  });

  test("large counts render correctly", () => {
    const body = buildComment(true, { maintainer: 10, teamLead: 20, other: 5 }, "");
    expect(body).toContain("Management 10");
    expect(body).toContain("Team Lead 20");
    expect(body).toContain("Member 5");
  });
});
