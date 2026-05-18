const { getLatestApprovals } = require("./approval");

async function fetchReviews(octokit, owner, repo, prNumber) {
  const { data: reviews } = await octokit.rest.pulls.listReviews({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  return reviews;
}

// Only write/maintain/admin access counts — read-only collaborators are excluded.
async function hasWriteAccess(octokit, owner, repo, login) {
  try {
    const { data } = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username: login,
    });
    return ["write", "maintain", "admin"].includes(data.permission);
  } catch {
    return false;
  }
}

async function resolveRole(octokit, org, login, reviewerTeams) {
  for (const [role, teamSlug] of Object.entries(reviewerTeams)) {
    try {
      const { data: membership } =
        await octokit.rest.teams.getMembershipForUserInOrg({
          org,
          team_slug: teamSlug,
          username: login,
        });
      if (membership.state === "active") return role;
    } catch {
      /* 404 = not a member */
    }
  }
  return "other";
}

async function buildApprovalCounts(octokit, org, repo, reviews, reviewerTeams) {
  const latestByUser = getLatestApprovals(reviews);
  const approvedReviews = Object.values(latestByUser).filter(
    (r) => r.state === "APPROVED",
  );

  const counts = { maintainer: 0, teamLead: 0, other: 0 };
  for (const review of approvedReviews) {
    const login = review.user.login;
    if (!(await hasWriteAccess(octokit, org, repo, login))) continue;
    const role = await resolveRole(octokit, org, login, reviewerTeams);
    counts[role]++;
  }
  return counts;
}

async function upsertPrComment(octokit, owner, repo, prNumber, body) {
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const existing = comments.find(
    (c) =>
      c.user?.login === "github-actions[bot]" &&
      c.body?.includes("## Review Status"),
  );

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
  }
}

module.exports = {
  fetchReviews,
  hasWriteAccess,
  resolveRole,
  buildApprovalCounts,
  upsertPrComment,
};
