const { withAppBuildGradle, withMainApplication } = require('expo/config-plugins');

function configureApplication(source) {
  if (!source.includes('import com.asinu.lite.updates.AsinuAppUpdatePackage')) {
    source = source.replace(/(package [^\n]+\n)/, '$1\nimport com.asinu.lite.updates.AsinuAppUpdatePackage\n');
  }
  if (!source.includes('add(AsinuAppUpdatePackage())')) {
    const anchor = /PackageList\(this\)\.packages\.apply\s*\{/;
    if (!anchor.test(source)) {throw new Error('Cannot register Asinu app updates');}
    source = source.replace(anchor, '$&\n      add(AsinuAppUpdatePackage())\n');
  }
  return source;
}

function configureGradle(source) {
  if (!source.includes('native/app-update/android')) {
    source = source.replace(/android\s*\{/, '$&\n    sourceSets { main.java.srcDir("../../native/app-update/android") }');
  }
  const dependency = 'implementation("com.google.android.play:app-update:2.1.0")';
  if (!source.includes(dependency)) {source = source.replace(/dependencies\s*\{/, `$&\n    ${dependency}`);}
  return source;
}

module.exports = config => {
  config = withMainApplication(config, mod => {
    mod.modResults.contents = configureApplication(mod.modResults.contents); return mod;
  });
  return withAppBuildGradle(config, mod => { mod.modResults.contents = configureGradle(mod.modResults.contents); return mod; });
};
module.exports.configureApplication = configureApplication;
module.exports.configureGradle = configureGradle;
