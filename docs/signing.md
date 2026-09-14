# macOS signing and notarization

Distribution builds use `build/signed-macos.cjs`. Regular PR checks keep the
ad-hoc package configuration and never receive signing secrets.

The Build macOS workflow requires these repository Actions secrets:

- `MAC_CERTIFICATE_P12`: base64-encoded Developer ID Application P12.
- `MAC_CERTIFICATE_PASSWORD`: its export password.
- `MAC_SIGNING_IDENTITY`: certificate identity without the `Developer ID Application:` prefix.
- `APPLE_API_KEY_CONTENT`: App Store Connect team key P8 contents.
- `APPLE_API_KEY_ID` and `APPLE_API_ISSUER`: key identifiers.

The release workflow passes the secrets to the reusable build. Missing credentials
fail the build, without falling back to ad-hoc signing. The P8 is written only to
runner temporary storage with owner-only permissions and removed when packaging
ends. electron-builder imports the P12 into its temporary signing keychain.
Never commit signing material or include it in build artifacts.

For a local distribution, use a Developer ID identity installed in Keychain and a
validated notarytool profile:

```sh
CSC_NAME='Your Name (TEAMID)' APPLE_KEYCHAIN_PROFILE=darsena-notary \
  pnpm exec electron-builder --config build/signed-macos.cjs --mac dmg zip --arm64 --publish never
DARSENA_REQUIRE_NOTARIZATION=1 node scripts/verify-macos.mjs
```

Build the application first with `pnpm build`. If Darsena is running, package to a
fresh output directory instead of replacing its app bundle. Never quit it automatically.

Electron-builder notarizes and staples the app before archiving. Verification
checks Developer ID, the stapled app ticket and Gatekeeper acceptance on the
original app and the copies extracted from DMG and ZIP. The build manifest records
observed signing and notarization status. Existing published assets are unchanged;
use a new release version to distribute notarized builds.
