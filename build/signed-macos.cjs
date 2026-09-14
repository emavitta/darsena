const { build } = require('../package.json')
if (!process.env.CSC_NAME) throw new Error('CSC_NAME is required for Developer ID signing')
if (!process.env.APPLE_KEYCHAIN_PROFILE && !(process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER)) {
  throw new Error('Notarization credentials are required for a signed distribution')
}
module.exports = {
  ...build,
  dmg: { ...build.dmg, artifactName: 'Darsena-${version}-${arch}.${ext}' },
  forceCodeSigning: true,
  mac: { ...build.mac, artifactName: 'Darsena-${version}-${arch}-mac.${ext}', identity: process.env.CSC_NAME, hardenedRuntime: true, notarize: true },
}
