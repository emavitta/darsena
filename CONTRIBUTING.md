# Contributing to Darsena

Issues are open for bug reports, ideas and discussion. **You do not need to open or link an issue before submitting a pull request.** For a larger change, an early discussion can help agree on scope.

## Pull requests

Create a branch, or fork the repository if you do not have write access, and open a pull request targeting `main`. Keep the change focused and describe what it does and how you checked it. UI screenshots are useful when the appearance or interaction changes.

All changes to `main` go through pull requests, including the maintainer's changes. Before merging:

- The **Validate macOS** check must pass against the current base branch.
- Review conversations must be resolved.
- Only a maintainer with write access can merge. Opening an issue or a pull request does not grant write access.

The default branch blocks direct pushes, force pushes and deletion, without bypass actors. There is no mandatory approval count while this is a project with one maintainer; requiring someone else's approval would block the maintainer's own pull requests. `CODEOWNERS` routes review requests to `emavitta`. Revisit mandatory approvals if the maintainer team grows.

## Local checks

Use macOS, Node.js 24 and the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
node --import tsx tests/ui-smoke.mjs
node --import tsx tests/project-removal-smoke.mjs
```

The desktop checks use disposable repositories and isolated settings. GitHub Actions runs these same checks for pull requests. Installer packaging and publication remain in the separate build and release workflows; PR checks do not publish releases.

Workflows from outside contributors require maintainer approval before running. Check the proposed code and workflow changes before approving execution. The default Actions token is read-only and cannot approve pull requests.

## Repository settings

The applied branch ruleset is recorded in [`.github/rulesets/main.json`](.github/rulesets/main.json). This file documents the configuration; editing it alone does not change GitHub's active rules. Keep the live ruleset and this file aligned when changing policy.

No linked issue, signed commit, coverage percentage or particular commit-message format is required.
