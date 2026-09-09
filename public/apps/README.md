# Application shortcut icons

These icons identify the applications opened by Darsena's folder shortcuts.
They are exported from the locally installed macOS applications without
redrawing or recoloring them:

- Visual Studio Code — Microsoft, `Code.icns`.
- Terminal — Apple, `Terminal.icns`.
- Android Studio — Google, `studio.icns`.

Names and artwork belong to their respective owners. They are not Darsena branding.
Run `node scripts/app-icons.mjs` on a Mac with these apps installed to regenerate
the 128 px PNG assets. They are bundled locally, so the UI does not fetch images
from the network.
