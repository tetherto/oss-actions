# count-pending-reviews

A reusable JavaScript GitHub Action that evaluates PR approvals by reviewer role
and posts/updates a single PR comment with the current review status.

## What it does

1. Fetches all PR reviews and keeps only the latest review per reviewer.
2. Counts only `APPROVED` reviews from users with at least repository `write`
   permission (`write`, `maintain`, or `admin`).
3. Classifies each approver as:
   - `maintainer` (member of `maintainers-github-team`)
   - `teamLead` (member of `team-leads-github-team`)
   - `other` (everyone else with write-or-higher permission)
4. Marks the PR as approved when both conditions are true:
   - at least 1 code-owner approval (`maintainer` or `teamLead`)
   - at least `total-required-approvals` total approvals
5. Creates or updates a single bot comment headed by `## Review Status`.

## Inputs

| Input                      | Required | Default               | Description                                                      |
| -------------------------- | -------- | --------------------- | ---------------------------------------------------------------- |
| `pat-token`                | ✅       | -                     | Token used for org/team membership checks (`read:org` required). |
| `github-token`             | ✅       | `${{ github.token }}` | Token used to create/update PR comments.                         |
| `pr-number`                | ✅       | -                     | Pull request number to evaluate.                                 |
| `maintainers-github-team`  | ✅       | -                     | Team slug for maintainers/management reviewers.                  |
| `team-leads-github-team`   | ✅       | -                     | Team slug for team lead reviewers.                               |
| `total-required-approvals` | ✅       | `2`                   | Minimum total approvals required.                                |

## Outputs

This action currently does not define step outputs. It communicates results via
the PR comment only.

## Example usage

```yaml
- name: Count pending reviews
  uses: ./.github/actions/count-pending-reviews
  with:
    pat-token: ${{ secrets.PAT_TOKEN }}
    github-token: ${{ github.token }}
    pr-number: ${{ github.event.pull_request.number }}
    maintainers-github-team: qvac-internal-merge-mgmt
    team-leads-github-team: qvac-internal-merge
    total-required-approvals: 2
```

## Token requirements

- `pat-token` must be able to query team membership (`read:org`).
- `github-token` (or alternate token) must be able to read and write PR comments.

## Development

```bash
npm install
npm test
npm run build
```

The action runtime executes `dist/index.js` (`using: node24`). Commit both
source files and rebuilt `dist/` whenever you change action logic.
