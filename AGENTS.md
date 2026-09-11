# Local Darsena installation

User preference: after changing Darsena, update the local macOS app as well, provided Darsena is not running.

- Complete relevant validation and build a fresh macOS application bundle.
- Check for running Darsena processes before packaging into an existing app location and again immediately before replacing the installed app. Closing its window does not mean the app has quit.
- If Darsena is running, leave it and its tasks alone, skip installation, and report that the local app update is pending. Do not quit it automatically.
- Update `/Applications/Darsena.app` (or the existing user installation if located elsewhere). Preserve user settings and application data.
- Do not launch the app automatically or publish a GitHub release as part of this local update.

# UI components

Nuxt UI is being adopted incrementally, starting with Preferences → Applications.
Use Nuxt UI for new shared controls and follow the theme/integration in
`app/assets/nuxt-ui.css`. Keep domain layouts and branding custom. Do not introduce
remote fonts/icons or relax Electron CSP. Preserve native `AppDialog` until its
scroll/focus consumers are explicitly migrated; portal overlays into that dialog.
See `docs/components.md` and run the Preferences smoke test for shared-control changes.
