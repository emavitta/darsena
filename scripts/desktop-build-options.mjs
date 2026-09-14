// CommonJS dependencies may require Node built-ins from inside our ESM bundles.
export const desktopBuildOptions = {
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  banner: { js: "import { createRequire as darsenaCreateRequire } from 'node:module'; const require = darsenaCreateRequire(import.meta.url);" },
}
