const core = require("@actions/core");
const github = require("@actions/github");

const {
  checkApproved,
  getPendingMessage,
  buildComment,
} = require("./approval");
const {
  fetchReviews,
  buildApprovalCounts,
  upsertPrComment,
} = require("./github");

async function run() {
  const orgOctokit = github.getOctokit(
    core.getInput("pat-token", { required: true }),
  );
  const commentOctokit = github.getOctokit(
    core.getInput("github-token") || process.env.GITHUB_TOKEN,
  );
  const { owner, repo } = github.context.repo;

  const prNumber = parseInt(core.getInput("pr-number", { required: true }), 10);
  const minTotal = parseInt(
    core.getInput("total-required-approvals", { required: true }),
    10,
  );

  const reviewerTeams = {
    maintainer: core.getInput("maintainers-github-team", { required: true }),
    teamLead: core.getInput("team-leads-github-team", { required: true }),
  };

  const reviews = await fetchReviews(orgOctokit, owner, repo, prNumber);
  const counts = await buildApprovalCounts(
    orgOctokit,
    owner,
    repo,
    reviews,
    reviewerTeams,
  );

  const approved = checkApproved(counts, minTotal);
  const pendingMessage = approved ? "" : getPendingMessage(counts, minTotal);
  const commentBody = buildComment(approved, counts, pendingMessage);

  await upsertPrComment(commentOctokit, owner, repo, prNumber, commentBody);
}

run().catch((error) => core.setFailed(error.message));
