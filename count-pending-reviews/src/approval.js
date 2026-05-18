const DISPLAY = {
  maintainer: "Management",
  teamLead: "Team Lead",
  other: "Member",
};

const MIN_CODEOWNER = 1;

function getLatestApprovals(reviews) {
  return reviews.reduce((byUser, review) => {
    const username = review.user?.login;
    if (
      username &&
      (!byUser[username] || review.submitted_at > byUser[username].submitted_at)
    ) {
      byUser[username] = review;
    }
    return byUser;
  }, {});
}

function checkApproved(counts, minTotal) {
  const { maintainer = 0, teamLead = 0, other = 0 } = counts;
  const codeowner = maintainer + teamLead;
  const total = codeowner + other;
  return codeowner >= MIN_CODEOWNER && total >= minTotal;
}

function getPendingMessage(counts, minTotal) {
  const { maintainer = 0, teamLead = 0, other = 0 } = counts;
  const codeowner = maintainer + teamLead;
  const total = codeowner + other;

  const missingCodeowner = Math.max(0, MIN_CODEOWNER - codeowner);
  const missingTotal = Math.max(0, minTotal - total);
  const extraNeeded = Math.max(0, missingTotal - missingCodeowner);

  const parts = [];
  if (missingCodeowner > 0)
    parts.push(`${missingCodeowner} Management or Team Lead`);
  if (extraNeeded > 0)
    parts.push(`${extraNeeded} more from Management, Team Lead, or Member`);
  return parts.join(", and ");
}

function buildComment(approved, counts, pendingMessage) {
  const approvalSummary = Object.entries(counts)
    .map(([role, count]) => `${DISPLAY[role]} ${count}`)
    .join(", ");

  const lines = [
    "## Review Status",
    `**Current Status: ${approved ? "✅ APPROVED" : "❌ PENDING"}**`,
    `Approvals so far: ${approvalSummary}`,
  ];

  if (!approved) lines.push(`\nPending reviews: Needs ${pendingMessage}.`);

  return lines.join("\n");
}

module.exports = {
  DISPLAY,
  MIN_CODEOWNER,
  getLatestApprovals,
  checkApproved,
  getPendingMessage,
  buildComment,
};
