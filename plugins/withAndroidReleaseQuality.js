const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withGradleProperties,
} = require('@expo/config-plugins');

const scannerActivity =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';
const materialDependency = 'implementation("com.google.android.material:material:1.14.0")';

function configureManifest(manifest) {
  manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  application.$['android:resizeableActivity'] = 'true';

  // Expo's global portrait setting is retained for iOS. Android must also work
  // when a tablet/foldable rotates or resizes its window on Android 16.
  const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  delete mainActivity.$['android:screenOrientation'];

  application.activity ??= [];
  let scanner = application.activity.find(
    (activity) => activity.$['android:name'] === scannerActivity,
  );
  if (!scanner) {
    scanner = { $: { 'android:name': scannerActivity } };
    application.activity.push(scanner);
  }
  delete scanner.$['android:screenOrientation'];
  const removedAttributes = new Set(
    (scanner.$['tools:remove'] || '').split(',').map((name) => name.trim()).filter(Boolean),
  );
  removedAttributes.add('android:screenOrientation');
  scanner.$['tools:remove'] = [...removedAttributes].join(',');
  return manifest;
}

function configureGradle(contents) {
  // The unoptimized default explicitly disables optimization, even with R8 on.
  contents = contents.replaceAll('proguard-android.txt', 'proguard-android-optimize.txt');
  if (!contents.includes(materialDependency)) {
    if (!/^dependencies\s*\{/m.test(contents)) {
      throw new Error('Android release quality expects an app dependencies block');
    }
    contents = contents.replace(
      /^dependencies\s*\{/m,
      `dependencies {\n    // Android 15+ edge-to-edge fixes for Material dialogs and system bars.\n    ${materialDependency}`,
    );
  }
  return contents;
}

function withAndroidReleaseQuality(config) {
  config = withAndroidManifest(config, (mod) => {
    mod.modResults = configureManifest(mod.modResults);
    return mod;
  });
  config = withGradleProperties(config, (mod) => {
    const key = 'android.r8.optimizedResourceShrinking';
    mod.modResults = mod.modResults.filter((entry) => entry.key !== key);
    mod.modResults.push({ type: 'property', key, value: 'true' });
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('Android release quality expects a Groovy app build.gradle');
    }
    mod.modResults.contents = configureGradle(mod.modResults.contents);
    return mod;
  });
}

module.exports = withAndroidReleaseQuality;
