# Dependency updates

The package manager is pinned in `package.json`. Use that pnpm version locally and in CI.

- `pnpm-workspace.yaml` sets `minimumReleaseAge: 10080` (seven days) for dependency resolution.
- Dependabot checks weekly and applies its own seven-day cooldown to version updates. Routine PRs cover patch and minor releases; major upgrades are planned and reviewed separately.
- Dependabot security updates bypass its cooldown. Review the advisory, changed versions and lockfile before merging; do not enable automatic merging.
- For an urgent fix blocked during local resolution, use a temporary `minimumReleaseAgeExclude` entry scoped to the exact package version, document the advisory in the PR, and remove the exception after the waiting period. Do not disable the age gate globally.
- CI installs with `--frozen-lockfile`. This preserves reviewed versions; it does not re-evaluate the age of every existing lockfile entry. Review lockfile changes from bots as well as manual changes.
- Dependency install scripts are allowed only for Electron, esbuild and sharp. Review any additional script permission explicitly.

The waiting period reduces exposure to newly published malicious packages. It does not replace dependency review, vulnerability auditing or tests.
