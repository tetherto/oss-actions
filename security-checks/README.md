# security-checks

Reusable composite action that runs a standard set of dependency/security
checks for Tether OSS repos so each repo no longer has to inline the same
logic in its CI workflow.

> [!IMPORTANT]
> This action is the **PR security gate** for OSS repos. It is designed
> to run on every `pull_request` — including PRs opened from external
> forks — and is the last automated check between a third-party
> dependency change and `main`. If you only adopt one CI quality bar
> from `oss-actions`, adopt this one.

What it runs (each can be skipped via an input):

1. **Dependency Review** — `actions/dependency-review-action` on the PR diff.
2. **Lockfile drift check** — re-resolves `package-lock.json` against
   `package.json` and fails if they diverge.
3. **`npm audit signatures`** — supply-chain signature check.
4. **`npm audit --audit-level=<level>`** — moderate-and-above advisory check.
5. **`audit-ci` high/critical gate** — opt-in, only check that hard-fails
   the job. **Only runs when the consumer repo commits an
   `audit-ci.jsonc`** (see [resolution order](#where-should-audit-cijsonc-live));
   without that file the step is silently skipped with a `::notice::`.

Additionally writes a Markdown summary block (status table + high/critical
package rows from `npm audit --json`) to `$GITHUB_STEP_SUMMARY`.

## Why this is the right PR gate for fork contributions

Most of our OSS repos accept PRs from external forks. Fork PRs are the
single highest-risk surface in a CI pipeline: a contributor can propose
arbitrary code, arbitrary `package.json` edits, and arbitrary
`postinstall` scripts. The choices baked into this action are
specifically tuned to make that surface safe.

> [!TIP]
> **Run on `pull_request`, never on `pull_request_target` for the
> security gate.** `pull_request` evaluates the workflow file from the
> **base** branch and gives fork PRs a **read-only `GITHUB_TOKEN` with
> no access to repository secrets**. That means a fork author cannot
> rewrite this workflow on their branch to skip checks, leak secrets,
> or escalate permissions — the gate is unforgeable from the PR side.

> [!IMPORTANT]
> **`actions/dependency-review-action` never executes code from the PR.**
> It compares the base and head dependency graphs through the GitHub
> REST/GraphQL API (GitHub Advisory Database + the repo's Dependency
> Graph). It fails the PR if a *newly added or upgraded* dependency
> introduces a vulnerability above `fail-on-severity` or an
> incompatible license. This makes it the safest possible gate for
> fork PRs: even a malicious `postinstall` in a freshly added
> dependency cannot run, because nothing is installed.

> [!NOTE]
> **The other steps also avoid executing fork code.** `npm audit` and
> `npm audit signatures` are pure registry-side advisory / signature
> lookups — they never run npm lifecycle scripts. The lockfile drift
> check uses
> `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`,
> which only re-resolves `package-lock.json`; no `node_modules/` is
> materialised and lifecycle hooks are skipped (`--ignore-scripts`), so
> the root package's `postinstall` does not run. End-to-end, **no step
> in this action executes any code authored in the PR**.

> [!TIP]
> **Dependency Review posts a structured PR comment** (`comment-summary-in-pr: always`)
> describing exactly which packages, severities, and licenses changed,
> and links every advisory back to GHSA. That gives the reviewer the
> security context inline with the rest of the PR review, instead of
> buried in CI logs — useful for fork PRs where the maintainer often
> does not personally know the contributor.

> [!WARNING]
> **Do not add `npm ci` (or any install that runs scripts) before this
> action runs.** If a later job in the same workflow does need to
> install (for build/test), either run it *after* the gate has passed,
> pass `--ignore-scripts`, or move it to a separate workflow.
> The lockfile step runs `npm install --package-lock-only
> --ignore-scripts` (no full `node_modules/` tree, no lifecycle
> scripts); it is still safe on fork PRs because nothing from the PR
> is executed.

> [!CAUTION]
> **Never switch this gate to `pull_request_target` to "make the PR
> comment work" for fork PRs.** `pull_request_target` checks out the
> *base* code by default but runs with the *base* repo's
> **write-capable** `GITHUB_TOKEN` and **full access to secrets**. If
> the workflow then checks out the PR head and runs anything from it,
> the fork has hijacked your CI. The step-summary fallback that
> Dependency Review produces when it cannot post a comment is the
> correct, intentional trade-off.

### Trust model summary

| Surface                                                      | Trust source         | Can a fork author tamper? |
| ------------------------------------------------------------ | -------------------- | ------------------------- |
| Workflow YAML (`.github/workflows/*.yml`)                    | Base branch          | No                        |
| Job `permissions:` block                                     | Base branch          | No                        |
| `GITHUB_TOKEN` on fork PRs                                   | GitHub               | Read-only, no secrets     |
| `actions/dependency-review-action`                           | GitHub-maintained    | No code execution from PR |
| `npm audit` / `npm audit signatures`                         | npm registry         | No code execution from PR |
| `npm install --package-lock-only --ignore-scripts`           | Lockfile resolver    | Lifecycle scripts skipped |
| `audit-ci` allowlist (`.github/audit-ci.jsonc`)              | Base branch          | No                        |
| Bundled scripts (`security-checks/scripts/*`)                | `oss-actions` @ pin  | No (pinned to `@v1`/SHA)  |
| Action sources (`tetherto/oss-actions/security-checks@v1`)   | `oss-actions` @ pin  | No                        |

In short: every input the gate consults is either GitHub-authoritative
metadata or content authored on the **base** branch. The PR head is
inspected but never executed.

## Requirements on the caller

- Event: `pull_request` (Dependency Review only works on PR events).
- Job permissions: `contents: read` and `pull-requests: read`.
- The job must run `actions/checkout` of the PR head **before** this action
  (the lockfile and audit steps read `package.json` / `package-lock.json`
  from the working tree).
- A Node-capable runner (`ubuntu-latest` is fine; `npm` is preinstalled).
- **Actions Runner ≥ v2.327.1.** Required by
  `actions/dependency-review-action@v5`, which runs on node24. The
  GitHub-hosted `ubuntu-latest` runner already satisfies this; self-hosted
  runners may need an upgrade.
- **Package manager: npm only (today).** The lockfile drift check,
  `npm audit signatures`, `npm audit`, and the `npm audit --json`
  rendering used for the high/critical summary are all npm-specific
  and assume `package-lock.json`. Only the GitHub Dependency Review
  step is package-manager-agnostic. Repos that do not use npm with a
  committed `package-lock.json` cannot adopt this action as-is and
  should either migrate to npm or keep their own CI until they do.

> [!IMPORTANT]
> Keep the `permissions:` block on this job as narrow as shown — only
> `contents: read` and `pull-requests: read`. The whole point of the
> fork-PR threat model above is that the gate runs with the **least**
> token capability that still works. Do not bump it to `write` to "get
> richer comments"; richer comments are not worth the secrets surface.

## Usage

```yaml
jobs:
  security_checks:
    name: Security Checks
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          persist-credentials: false

      # Drop a per-repo allowlist at `.github/audit-ci.jsonc` and the action
      # will auto-discover it — no `with:` block required.
      - uses: tetherto/oss-actions/security-checks@v1
```

> [!TIP]
> Pin the action to a tag (`@v1`) for everyday use; pin to a full SHA
> for repos under stricter supply-chain rules. The composite action
> internally pins every third-party action it calls (e.g.
> `actions/dependency-review-action@a1d282b...`, v5.0.0) to immutable
> SHAs so a tag bump can never silently swap an upstream action.

### Skipping a check

```yaml
- uses: tetherto/oss-actions/security-checks@v1
  with:
    skip-npm-audit-signatures: "true"
    skip-audit-ci: "true"
```

> [!WARNING]
> Skipping `audit-ci` removes the only **hard-fail** gate. A repo that
> sets `skip-audit-ci: "true"` will still surface warnings, but a high
> or critical advisory introduced by a fork PR will no longer block
> merge. Use this only as a temporary escape hatch (e.g. a triaged
> false positive that cannot be allowlisted via `audit-ci.jsonc`) and
> track it back to ON.

## Inputs

| Input | Default | Description |
|---|---|---|
| `skip-dependency-review` | `false` | Skip `actions/dependency-review-action`. |
| `dependency-review-fail-on-severity` | `moderate` | `fail-on-severity` value forwarded to dependency-review. |
| `dependency-review-vulnerability-check` | `true` | Forwarded as-is. |
| `dependency-review-license-check` | `true` | Forwarded as-is. |
| `dependency-review-comment-summary-in-pr` | `always` | Forwarded as-is. |
| `skip-lockfile-check` | `false` | Skip `package-lock.json` drift check. |
| `skip-npm-audit-signatures` | `false` | Skip `npm audit signatures`. |
| `skip-npm-audit-moderate` | `false` | Skip `npm audit --audit-level=<level>`. |
| `npm-audit-level` | `moderate` | Severity threshold for the moderate audit step. |
| `skip-audit-ci` | `false` | Skip the audit-ci high/critical hard-fail gate. |
| `audit-ci-config` | _(empty)_ | Path to `audit-ci.jsonc`. Resolution order: this input → `.github/audit-ci.jsonc` → `.github/scripts/audit-ci.jsonc` (legacy) → `audit-ci.jsonc` at repo root. **No file found → gate is skipped** (opt-in). |
| `audit-ci-version` | `7` | `audit-ci` npm package version. |
| `summary-title` | `Core Security Audit Summary` | Heading rendered above the audit summary table. |
| `scope-label` | `Core` | Label used in the Scope column of the audit summary table. |

## Where should `audit-ci.jsonc` live?

In the **consumer repo**, not inside this action. The allowlist is
risk-acceptance state (which GHSAs are tolerated for which packages, and
why) — it must be owned and edited by the repo maintainers, not by
shared infra. If we centralised it here, every false positive in any
consumer would require a PR + re-tag of `oss-actions` before the
high/critical gate would stop blocking.

Recommended path in a consumer repo:

```
.github/audit-ci.jsonc
```

The action auto-discovers this file in the following order:

1. `audit-ci-config` input (explicit path)
2. `.github/audit-ci.jsonc` ← **preferred**
3. `.github/scripts/audit-ci.jsonc` (legacy; back-compat)
4. `audit-ci.jsonc` at the repo root

> [!IMPORTANT]
> **The `audit-ci` high/critical gate is opt-in.** If none of the paths
> above resolve to an existing file, the step is **skipped** (not failed,
> not silently passed against a bundled default). The action emits a
> `::notice::` in the run log and renders a `> [!NOTE]` block in the
> step summary explaining how to enable it. We deliberately do **not**
> bundle a fallback `audit-ci` policy inside this action — a hard-fail
> gate must be a policy the consumer repo has explicitly accepted by
> committing a config.

Minimal opt-in config to drop at `.github/audit-ci.jsonc`:

```jsonc
{
  "$schema": "https://github.com/IBM/audit-ci/raw/main/docs/schema.json",
  "high": true,
  "allowlist": []
}
```

Add GHSA IDs to `allowlist` (with a code comment explaining why each is
tolerated) when you accept a specific false positive or a known-broken
transitive dep that you cannot upgrade right now.

## Failure semantics

Only the **audit-ci high/critical** step hard-fails the job (and only
when an `audit-ci.jsonc` exists in the consumer repo — see
[opt-in note](#where-should-audit-cijsonc-live)). The other checks emit
`::warning::` / `::error::` annotations and a status of `WARN` in the
step-summary table but do not fail the job, mirroring the behaviour
previously inlined in mdk-docs.

| Check                       | Status when no opt-in / no findings | Status on findings | Blocks the job? |
| --------------------------- | ----------------------------------- | ------------------ | --------------- |
| Dependency Review           | n/a (always runs)                   | PR fails           | **Yes**         |
| Lockfile drift              | PASS                                | error annotation   | No (`continue-on-error`) |
| `npm audit signatures`      | PASS                                | WARN               | No              |
| `npm audit --audit-level`   | PASS                                | WARN               | No              |
| `audit-ci` high/critical    | **SKIP** if no `audit-ci.jsonc`     | WARN + non-zero    | **Yes** (only if opted in) |

> [!NOTE]
> Treating moderate audit and signatures as non-blocking is a
> deliberate noise/signal trade-off: moderate advisories churn (false
> positives, advisories without fixes, advisories on transitive devDeps)
> and would otherwise wedge fork PRs that have no relation to the
> finding. The maintainer still sees the WARN row in the step summary
> and the PR comment from Dependency Review, and can decide to
> escalate by editing `.github/audit-ci.jsonc` or bumping
> `dependency-review-fail-on-severity` per repo.

> [!IMPORTANT]
> If you want this gate to be a **required status check** in branch
> protection, point branch protection at the **summary** job that
> aggregates this and the other checks, not at `security_checks`
> directly — that way a job rename or split here cannot break branch
> protection silently.

## Files

- `action.yml` — the composite action.
- `scripts/github-summary-npm-audit.sh` — renders the GitHub Actions
  step summary from `npm audit --json`: severity overview, a capped
  moderate package table, then high/critical package rows (same
  advisor/dependent formatting as before).

> [!NOTE]
> This action used to ship `scripts/audit-ci.default.jsonc` as a fallback
> policy. It was removed: a hard-fail gate must be opted into per repo,
> never imposed by shared infra. The opt-in file lives in the consumer
> repo at `.github/audit-ci.jsonc`.
