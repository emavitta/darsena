# Security review — 16 September 2026

Targeted source, dependency and repository-configuration review. This is not a
penetration test or a guarantee that every vulnerability has been found.

## Findings and changes

- Full dependency audit initially reported two high-severity advisories for
  `sharp` and one low-severity advisory for a transitive `esbuild`. Updated sharp
  to 0.35.4 and constrained affected esbuild versions to 0.28.2. These findings
  concern image/build tooling; sharp is not imported by the app's runtime code.
  The complete dependency audit reports zero known advisories after the changes.
  A production-only audit is insufficient here because runtime libraries are
  bundled from devDependencies.
- CI now audits all dependencies and fails on high/critical advisories.
- Deny browser permission requests/checks explicitly. Folder selection and
  clipboard actions still use the application's explicit native bridge.
- Updater eligibility now requires the app's identifier, the Darsena signing
  team and a Developer ID Application certificate, rather than the team alone.
- Ignore local signing keys, certificates with private keys and password files,
  in addition to existing `.env` exclusions.
- GitHub Dependabot alerts and automated security-fix PRs enabled. Main branch
  protections, GitHub secret scanning and secret push protection were already on.

Advisories:
- https://github.com/advisories/GHSA-f88m-g3jw-g9cj
- https://github.com/advisories/GHSA-rgj7-g3m4-5g8c
- https://github.com/advisories/GHSA-g7r4-m6w7-qqqr

## Checks performed

- No tracked `.env`, private-key or signing-credential files found. Inspected 769
  non-image Git objects reachable from locally available refs for private-key
  headers, GitHub/AWS token formats and literal hexadecimal MCP bearer tokens:
  no matches. This pattern scan does not detect every possible secret format or
  cover deleted, unreachable remote history. GitHub secret-scanning alerts were empty.
- Packaging uses an explicit allowlist of compiled frontend/backend files and
  package metadata. Signing secrets are scoped to the packaging workflow step;
  temporary notarization keys are created with a restrictive umask and removed
  on exit. PR validation does not receive those secrets.
- Renderer uses sandboxing, context isolation and disabled Node integration.
  New windows and external navigation are blocked. IPC validates origin and
  method inputs. External links are restricted to HTTP/HTTPS.
- MCP binds to loopback, rejects browser origins/unexpected hosts, requires a
  constant-time token comparison and enforces project/task grants. Tokens are
  persisted with owner-only permissions. Request size/concurrency are bounded.
- Folder resolution checks real paths and rejects traversal/escaping symlinks.
  Commands are launched with argument arrays. Custom scripts intentionally run
  with the user's privileges and environment; this is not a sandbox for
  untrusted repositories.
- Update selection uses the fixed GitHub repository, architecture-specific
  metadata, download hashes and native macOS signature verification. Real
  signed release-to-release installation remains a separate acceptance test.

## Remaining boundaries

The CSP still permits inline scripts for the generated Nuxt document. Removing
that allowance needs a dedicated hash/nonce integration and renderer tests.
There is no observed HTML injection sink in the reviewed app components, but
this remains a defense-in-depth improvement rather than a completed hardening.

Task output may contain secrets printed by project scripts. Authorized MCP
clients can read shared project logs. Darsena does not promise automatic secret
redaction or isolation of a command from the user's environment.

Dependency advisories and repository alerts change over time. The audit result
is a snapshot; the new CI check and Dependabot provide ongoing detection.
