# Building and distributing Darsena

Builds can happen on your Mac or on GitHub. **GitHub Releases** is the shared
download page in either case; compiled applications stay out of Git history.
The current supported target is **macOS on Apple Silicon**. Builds are unsigned
and not notarized. Windows needs platform integration work before it becomes a
distribution target.

## Recommended flow

1. Commit and push the version you want to distribute. Set the version in
   `package.json` before building; use a new version for each published build.
2. Build and test it locally, or run **Build macOS** in GitHub Actions.
3. Install that build and try it with a disposable repository.
4. Create a Release for that exact source commit and attach the DMG, ZIP and
   checksums. Use a **pre-release** while Darsena is being tried by early users.

A tag such as `v0.1.0` identifies the source; the Release contains the download
files and notes. Tags and published download files should not be silently
replaced when code changes. Publish a new version instead.

## Build on GitHub

Open [Actions → Build macOS](https://github.com/emavitta/darsena/actions/workflows/build-macos.yml),
choose **Run workflow**, and select the branch or tag to build. Repository write
access is needed to start it. The equivalent CLI command is:

```sh
gh workflow run build-macos.yml --repo emavitta/darsena --ref main
gh run list --repo emavitta/darsena --workflow build-macos.yml --limit 5
```

The workflow installs the locked dependencies with Node 24 and the project's
pinned pnpm version, checks TypeScript, runs backend tests and desktop smoke
tests, and packages an unsigned DMG and ZIP on a `macos-15` ARM64 runner. It also
verifies the archives and generates `SHA256SUMS.txt` and `SOURCE_COMMIT.txt`.
It uses a read-only repository token and does not create tags or releases.

On the completed run page, download the `darsena-macos-arm64-<commit>` artifact.
Extract it to get the installers. Artifacts in this workflow expire after
**14 days** and their download requires a GitHub login. Use a public Release
for a persistent link that colleagues can download without signing in.
[GitHub's artifact documentation](https://docs.github.com/en/actions/tutorials/store-and-share-data)
explains retention and downloads.

The standard hosted runners are currently free for public repositories such as
this one; private repositories have different usage allowances.
[GitHub runner documentation](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
lists the supported images and billing distinction.

## Build locally

Use a clean, committed checkout on an Apple Silicon Mac. Quit a previously
packaged Darsena before rebuilding into its output folder.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm dist:mac
node --import tsx tests/ui-smoke.mjs
node --import tsx tests/project-removal-smoke.mjs
```

For version `0.1.0`, verify and record the exact outputs:

```sh
hdiutil verify release/Darsena-0.1.0-arm64.dmg
unzip -tq release/Darsena-0.1.0-arm64-mac.zip
git rev-parse HEAD > release/SOURCE_COMMIT.txt
(
  cd release
  shasum -a 256 Darsena-0.1.0-arm64.dmg Darsena-0.1.0-arm64-mac.zip > SHA256SUMS.txt
)
```

Update the filenames when the package version changes. Build from the commit
being released; do not attach installers left over from a previous checkout.

## Distribute either build through Releases

The simplest route is [Releases → Draft a new release](https://github.com/emavitta/darsena/releases/new).
Select or create a version tag at the source commit, add short release notes,
attach the DMG, ZIP, `SHA256SUMS.txt` and `SOURCE_COMMIT.txt`, mark it as a
pre-release, then publish when the build has been tried.
GitHub's automatically generated **Source code** archives contain the source,
not an installable application.

With the CLI, the following example prepares a draft for version `0.1.0` from
files in `release/`. For an Actions build, put the extracted artifact files there
first and use its `SOURCE_COMMIT.txt`, not your current checkout's HEAD.

```sh
gh release create v0.1.0 \
  release/Darsena-0.1.0-arm64.dmg \
  release/Darsena-0.1.0-arm64-mac.zip \
  release/SHA256SUMS.txt \
  release/SOURCE_COMMIT.txt \
  --repo emavitta/darsena \
  --target "$(cat release/SOURCE_COMMIT.txt)" \
  --title 'Darsena 0.1.0 — macOS preview' \
  --notes 'First preview for Apple Silicon Macs. Unsigned and not notarized. Includes worktree browsing, folder shortcuts and task supervision.' \
  --draft --prerelease
```

Review the draft in the GitHub Releases page and publish it there, or run:

```sh
gh release edit v0.1.0 --repo emavitta/darsena --draft=false
```

If the release already exists, add missing files with `gh release upload`
instead of recreating it. Avoid `--clobber` on a published build. See the
[GitHub CLI release commands](https://cli.github.com/manual/gh_release).

## Next increments

- Once this manual flow is comfortable, a pushed version tag can build and
  populate a draft Release automatically.
- Signing and notarization need an Apple Developer ID identity and credentials;
  hosting a DMG on GitHub does not sign it.
- Windows can join the workflow on its own Windows runner after the app's
  launchers, process supervision and window lifecycle have been adapted.
- In-app updates are a separate feature; a GitHub Release alone does not add an
  updater to Darsena.

[electron-builder's GitHub Actions guide](https://www.electron.build/docs/github-actions/)
covers the later build, signing and draft-release automation.
