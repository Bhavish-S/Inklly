/**
 * Adds a <queries> block to AndroidManifest.xml so that, on Android 11+ (package visibility),
 * the app can see / launch UPI apps (upi://, phonepe://, paytmmp://, tez://, gpay://, credpay://)
 * plus tel:, mailto: and WhatsApp.
 *
 * Only used for EAS / prebuild builds; Expo Go uses its own manifest.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const DEFAULT_SCHEMES = ['upi', 'phonepe', 'paytmmp', 'tez', 'gpay', 'credpay', 'tel', 'mailto', 'whatsapp'];

function viewIntent(scheme) {
  return {
    action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    category: [{ $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
    data: [{ $: { 'android:scheme': scheme } }],
  };
}

module.exports = function withAndroidQueries(config, props = {}) {
  const schemes = props.schemes || DEFAULT_SCHEMES;
  const packages = props.packages || [];
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries || [];
    const queries = manifest.queries[0] || {};
    queries.intent = queries.intent || [];
    const existing = new Set(
      queries.intent.map((i) => i.data && i.data[0] && i.data[0].$ && i.data[0].$['android:scheme']).filter(Boolean)
    );
    for (const scheme of schemes) {
      if (!existing.has(scheme)) queries.intent.push(viewIntent(scheme));
    }
    if (packages.length) {
      queries.package = queries.package || [];
      const pkgs = new Set(queries.package.map((p) => p.$['android:name']));
      for (const name of packages) if (!pkgs.has(name)) queries.package.push({ $: { 'android:name': name } });
    }
    manifest.queries[0] = queries;
    return cfg;
  });
};
