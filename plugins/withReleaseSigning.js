const { withAppBuildGradle } = require('@expo/config-plugins');

const signingImport = 'apply from: "../../plugins/android-release-signing.gradle"';

function applyReleaseSigning(contents) {
  if (contents.includes(signingImport)) return contents;
  // Applying last overrides Expo's template debug fallback. EAS subsequently
  // injects its own managed signing configuration, validated at task execution.
  return `${contents.trimEnd()}\n\n${signingImport}\n`;
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('Release signing expects a Groovy app build.gradle');
    mod.modResults.contents = applyReleaseSigning(mod.modResults.contents);
    return mod;
  });
}

module.exports = withReleaseSigning;
module.exports.applyReleaseSigning = applyReleaseSigning;
