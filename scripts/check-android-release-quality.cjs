const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { AndroidConfig, compileModsAsync } = require('@expo/config-plugins');
const withAndroidReleaseQuality = require('../plugins/withAndroidReleaseQuality');
const { withBuildProperties } = require('expo-build-properties');
const appConfig = require('../app.json').expo;
const androidBuildProperties = appConfig.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
)[1];

const projectRoot = path.resolve(__dirname, '..');
const scannerName =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

function checkManifest(manifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  assert.equal(application.$['android:resizeableActivity'], 'true');
  assert.equal(mainActivity.$['android:screenOrientation'], undefined);
  const scanners = application.activity.filter((activity) => activity.$['android:name'] === scannerName);
  assert.equal(scanners.length, 1);
  assert.equal(scanners[0].$['android:screenOrientation'], undefined);
  assert.ok(scanners[0].$['tools:remove'].split(',').includes('android:screenOrientation'));
  return scanners[0];
}

async function main() {
  // Exercise the actual Expo mod pipeline on a portrait-locked native project.
  // Applying it twice must neither duplicate dependencies nor reset other
  // scanner attributes, signing configuration or application entry points.
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'asinu-release-quality-test-'));
  try {
    const manifestPath = path.join(fixture, 'android/app/src/main/AndroidManifest.xml');
    const gradlePath = path.join(fixture, 'android/app/build.gradle');
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(path.join(fixture, 'android/settings.gradle'), '// Fixture settings\n');
    const stylesPath = path.join(fixture, 'android/app/src/main/res/values/styles.xml');
    await fs.mkdir(path.dirname(stylesPath), { recursive: true });
    await fs.writeFile(stylesPath, '<resources><style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar"/></resources>');
    await fs.writeFile(manifestPath, `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
      <application android:name=".MainApplication" android:resizeableActivity="false">
        <activity android:name=".MainActivity" android:screenOrientation="portrait" android:exported="true">
          <intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter>
        </activity>
        <activity android:name="${scannerName}" android:screenOrientation="portrait" android:exported="false" tools:remove="android:maxAspectRatio"/>
      </application>
    </manifest>`);
    await fs.writeFile(gradlePath, `android { buildTypes { release { proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro" } } }
dependencies {
    implementation("com.facebook.react:react-android")
}
apply from: "../../plugins/android-release-signing.gradle"
`);
    await fs.writeFile(path.join(fixture, 'android/gradle.properties'), 'android.r8.optimizedResourceShrinking=false\n');
    const proguardPath = path.join(fixture, 'android/app/proguard-rules.pro');
    await fs.writeFile(proguardPath, '# Existing project rules\n');
    const evaluate = () => compileModsAsync(
      withBuildProperties(
        withAndroidReleaseQuality({ name: 'Fixture', slug: 'fixture', android: { package: 'com.asinu.lite' } }),
        androidBuildProperties,
      ),
      { projectRoot: fixture, platforms: ['android'], assertMissingModProviders: false },
    );
    await evaluate();
    const firstGradle = await fs.readFile(gradlePath, 'utf8');
    await evaluate();
    assert.equal(await fs.readFile(gradlePath, 'utf8'), firstGradle);
    const proguard = await fs.readFile(proguardPath, 'utf8');
    assert.equal(proguard.match(/-keep class livekit\.org\.jni_zero\.\*\* \{ \*; \}/g)?.length, 1);
    assert.ok(proguard.includes('# Existing project rules'));
    assert.match(firstGradle, /proguard-android-optimize\.txt/);
    assert.match(firstGradle, /android-release-signing\.gradle/);
    const scanner = checkManifest(await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath));
    assert.equal(scanner.$['android:exported'], 'false');
    assert.ok(scanner.$['tools:remove'].split(',').includes('android:maxAspectRatio'));
    const properties = await fs.readFile(path.join(fixture, 'android/gradle.properties'), 'utf8');
    assert.equal(properties.match(/^android\.r8\.optimizedResourceShrinking=true$/gm)?.length, 1);
    assert.doesNotMatch(properties, /^android\.r8\.optimizedResourceShrinking=false$/m);
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
  console.log('PASS Android prebuild removes portrait locks, preserves signing and LiveKit JNI rules, and is idempotent');

  // Include Expo's built-in orientation mod and the real plugin ordering.
  const cliRequire = createRequire(require.resolve('@expo/cli'));
  const { getPrebuildConfigAsync } = cliRequire('@expo/prebuild-config');
  const { exp } = await getPrebuildConfigAsync(projectRoot, { platforms: ['android'] });
  const result = await compileModsAsync(exp, {
    projectRoot, platforms: ['android'], introspect: true, assertMissingModProviders: false,
  });
  checkManifest(result._internal.modResults.android.manifest);
  const properties = Object.fromEntries(result._internal.modResults.android.gradleProperties
    .filter((entry) => entry.type === 'property').map((entry) => [entry.key, entry.value]));
  for (const key of ['android.enableMinifyInReleaseBuilds', 'android.enableShrinkResourcesInReleaseBuilds', 'android.r8.optimizedResourceShrinking']) {
    assert.equal(properties[key], 'true', key);
  }
  assert.equal(exp.orientation, 'portrait', 'Retain the existing iOS orientation preference');
  console.log('PASS real Expo configuration keeps R8 enabled and Android resizable after prebuild');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
