# Building and distributing Darsena

The supported preview target is **macOS on Apple Silicon**. Windows work is
paused on [`feat/windows-preview`](https://github.com/emavitta/darsena/tree/feat/windows-preview)
and is not part of releases from `main`.

GitHub Releases holds the public downloads, whether built on GitHub or locally.
The current Mac installers are unsigned and not notarized.

## Build without releasing

Open [Actions → Build macOS](https://github.com/emavitta/darsena/actions/workflows/build-macos.yml)
and choose **Run workflow**. It installs the locked dependencies, checks
TypeScript, runs backend tests, builds the DMG/ZIP and tests the packaged app
with disposable repositories and isolated settings. It then verifies the
archives and writes checksums plus the exact source commit.

```sh
gh workflow run build-macos.yml --repo emavitta/darsena --ref main
gh run list --repo emavitta/darsena --workflow build-macos.yml --limit 5
```

The `darsena-macos-arm64` artifact contains DMG, ZIP,
`SHA256SUMS-macos-arm64.txt` and `build-macos-arm64.json`. It expires after 14 days
and requires a GitHub login to download. Use a Release for persistent, public
download links. Standard hosted runners are currently free for public
repositories; private repositories have different allowances.
[GitHub runner documentation](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

## Prepare a Release from a version tag

1. Set the version in `package.json`, add notes in `docs/releases/vX.Y.Z.md`,
   commit and push.
2. Tag that commit with the matching version and push the tag.
3. **Prepare release** runs the same macOS build and tests.
4. After success it downloads the artifact, verifies the checksums and creates
   a **draft pre-release** with installers and source metadata.
5. Review and try the downloads, then publish the draft in Releases.

For a future version `0.1.1`, after updating and committing the version:

```sh
git tag -a v0.1.1 -m 'Darsena 0.1.1'
git push origin v0.1.1
```

The tag must match `package.json`. The workflow uses GitHub's built-in token;
no personal token is needed. Only the final release job has repository write
permission. Re-running a tag can update its draft assets, but refuses to replace
an already published release. Use a new version for changed downloads.

A published **pre-release** is publicly downloadable; a **draft** is only visible
to repository collaborators. GitHub's automatic Source code archives are not
installable applications.

## Build locally and attach downloads

Use a clean, committed checkout on an Apple Silicon Mac, with Node 24 and the
project's pinned pnpm version. Quit a packaged app before rebuilding into its
output folder. `pnpm dist:mac` only builds; it does not upload or publish.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm dist:mac
node scripts/release-manifest.mjs
```

Test the application from `release/mac-arm64/Darsena.app`. The manifest records
the current checkout, so generate it with the build from that exact commit.
For version 0.1.0, verify the downloads with:

```sh
hdiutil verify release/Darsena-0.1.0-arm64.dmg
unzip -tq release/Darsena-0.1.0-arm64-mac.zip
(cd release && shasum -a 256 --check SHA256SUMS-macos-arm64.txt)
```

In [Releases](https://github.com/emavitta/darsena/releases), create a draft for
the source tag, add notes and attach the DMG, ZIP, checksum file and build
manifest. This needs no Actions run. The equivalent CLI example, for an
existing `v0.1.0` tag without a Release, is:

```sh
gh release create v0.1.0 \
  release/Darsena-0.1.0-arm64.dmg \
  release/Darsena-0.1.0-arm64-mac.zip \
  release/SHA256SUMS-macos-arm64.txt \
  release/build-macos-arm64.json \
  --repo emavitta/darsena --verify-tag \
  --title 'Darsena 0.1.0 — macOS preview' \
  --notes-file docs/releases/v0.1.0.md --draft --prerelease
```

Use the actual version's filenames and tag. If a draft already exists, add files
with `gh release upload` instead. Avoid replacing published downloads. Review
the draft in GitHub and publish it there, or run
`gh release edit <tag> --repo emavitta/darsena --draft=false`.
[GitHub CLI release commands](https://cli.github.com/manual/gh_release).

## Signing and updates

Hosting a DMG on GitHub does not sign it. Apple Developer ID signing and
notarization can be added later with credentials stored in Actions secrets.
In-app updates are a separate feature; publishing a Release alone does not add
an updater to Darsena.

See [electron-builder's Actions guide](https://www.electron.build/docs/github-actions/)
and [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).
