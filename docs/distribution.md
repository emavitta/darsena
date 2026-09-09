# Building and distributing Darsena

The supported preview targets are **macOS Apple Silicon** and **Windows 10/11
x64**. GitHub Releases holds the public downloads, whether they were built on
GitHub or locally. The installers are unsigned; the Mac build is not notarized.

## Build without releasing

Open [Actions → Build desktop](https://github.com/emavitta/darsena/actions/workflows/build-desktop.yml)
and choose **Run workflow**. Both platforms install the locked dependencies,
check TypeScript, test Git and process behavior, and package the application.
Desktop tests run against the packaged Mac app and the installed Windows app.

Each successful job uploads `darsena-macos-arm64` or `darsena-windows-x64`.
The artifact contains the installers, a `SHA256SUMS-<target>.txt` file and
`build-<target>.json` recording the version and source commit. Artifacts expire
in 14 days and require a GitHub login to download. Release assets are the
persistent public download route.

```sh
gh workflow run build-desktop.yml --repo emavitta/darsena --ref main
gh run list --repo emavitta/darsena --workflow build-desktop.yml --limit 5
```

Standard GitHub-hosted runners are currently free for public repositories.
Private repositories have different allowances.
[GitHub runner documentation](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

## Prepare a release from a version tag

1. Set the version in `package.json`, add notes in `docs/releases/vX.Y.Z.md`,
   commit and push. Keep the version in the UI current too.
2. Tag that commit with the matching version and push the tag.
3. **Prepare release** calls the same two-platform build. Both jobs must pass.
4. The workflow downloads both artifacts, verifies their checksums and creates
   a **draft pre-release** containing all installers and source metadata.
5. Try the downloads, review the notes, and publish the draft in Releases.

For a future version `0.2.1`, after updating and committing the version:

```sh
git tag -a v0.2.1 -m 'Darsena 0.2.1'
git push origin v0.2.1
```

The tag must match `package.json`. The workflow uses GitHub's built-in token;
no personal access token or signing secret is needed for unsigned builds.
Only the final release job has repository write permission. Re-running a tag
can replace assets in its **draft**, but refuses to modify an already published
release. Use a new version for changed published downloads.

A Release marked as a pre-release can be published and downloaded normally; a
**draft** is only visible to repository collaborators. GitHub's automatic Source
code archives are not installers.

## Build locally and attach the downloads

Use a clean, committed checkout of the version being released. Run on each
platform separately, with Node 24 and the project's pinned pnpm version.
Quit a packaged app before rebuilding over its output folder.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm dist:mac       # On an Apple Silicon Mac
# or: pnpm dist:win # On Windows x64
node scripts/release-manifest.mjs
```

Open the built app and test it. The manifests describe the current checkout,
so build from the committed source and regenerate them in the same checkout.
For version 0.2.0, the downloads are:

| Platform            | Installer                       | Archive                         |
| ------------------- | ------------------------------- | ------------------------------- |
| macOS Apple Silicon | `Darsena-0.2.0-arm64.dmg`       | `Darsena-0.2.0-arm64-mac.zip`   |
| Windows x64         | `Darsena-0.2.0-windows-x64.exe` | `Darsena-0.2.0-windows-x64.zip` |

In [Releases](https://github.com/emavitta/darsena/releases), create a draft for
the source tag, paste the notes and attach the installers, checksum files and
build manifests. This needs no Actions run. To upload files to an existing
**draft**, the CLI also supports:

```sh
gh release upload v0.2.0 release/Darsena-0.2.0-windows-x64.exe \
  release/Darsena-0.2.0-windows-x64.zip \
  release/SHA256SUMS-windows-x64.txt release/build-windows-x64.json \
  --repo emavitta/darsena
```

Use the files and tag for the actual version. Avoid replacing assets that have
already been published. Review the draft in GitHub and publish it there, or use
`gh release edit <tag> --repo emavitta/darsena --draft=false`.
[GitHub CLI release commands](https://cli.github.com/manual/gh_release).

## Signing and updates

Hosting on GitHub does not sign the application. Apple signing/notarization and
Windows signing require their respective identities and credentials, which can
later be provided as Actions secrets. In-app updates are also a separate feature;
publishing a Release does not add an updater to Darsena.

See [electron-builder's Actions guide](https://www.electron.build/docs/github-actions/)
and [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).
