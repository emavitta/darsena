export function desktopLaunchAllowed(env) {
  return env.GITHUB_ACTIONS === 'true' || env.DARSENA_ALLOW_INTERACTIVE_TESTS === '1'
}
export function assertDesktopLaunchAllowed(env) {
  if (!desktopLaunchAllowed(env)) throw new Error(
    'Desktop tests open native windows and can take keyboard focus. Run them in GitHub Actions. ' +
    'For an explicitly requested local interactive session, set DARSENA_ALLOW_INTERACTIVE_TESTS=1.',
  )
}
