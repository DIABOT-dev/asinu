const { withAndroidManifest, withAppBuildGradle, withMainApplication } = require('expo/config-plugins');

function configureManifest(manifest) {
  const application = manifest.manifest.application[0];
  application.$['android:allowBackup'] = 'false';
  manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  const upsert = (collection, name, attributes) => {
    application[collection] ||= [];
    const found = application[collection].find(item => item.$['android:name'] === name);
    if (found) Object.assign(found.$, attributes);
    else application[collection].push({ $: { 'android:name': name, ...attributes } });
  };
  upsert('service', 'expo.modules.notifications.service.ExpoFirebaseMessagingService', { 'tools:node': 'remove' });
  upsert('service', '.notifications.AsinuFirebaseMessagingService', { 'android:exported': 'false', 'android:directBootAware': 'true' });
  const service = application.service.find(item => item.$['android:name'] === '.notifications.AsinuFirebaseMessagingService');
  service['intent-filter'] = [{ $: { 'android:priority': '100' }, action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }] }];
  upsert('activity', '.notifications.CheckinIncomingCallActivity', {
    'android:exported': 'false', 'android:excludeFromRecents': 'true',
    'android:theme': '@android:style/Theme.Material.Light.NoActionBar',
  });
  upsert('receiver', '.notifications.CheckinCallDeclineReceiver', { 'android:exported': 'false' });
  manifest.manifest['uses-permission'] ||= [];
  for (const name of ['android.permission.POST_NOTIFICATIONS', 'android.permission.USE_FULL_SCREEN_INTENT', 'android.permission.VIBRATE']) {
    if (!manifest.manifest['uses-permission'].some(item => item.$['android:name'] === name)) manifest.manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
  return manifest;
}

function configureApplication(source) {
  if (!source.includes('import com.asinu.lite.notifications.AsinuCheckinCallPackage')) {
    source = source.replace(/(package [^\n]+\n)/, '$1\nimport com.asinu.lite.notifications.AsinuCheckinCallPackage\n');
  }
  if (!source.includes('add(AsinuCheckinCallPackage())')) {
    const anchor = /PackageList\(this\)\.packages\.apply\s*\{/;
    if (!anchor.test(source)) throw new Error('Cannot register Asinu check-in package in MainApplication');
    source = source.replace(anchor, '$&\n      add(AsinuCheckinCallPackage())');
  }
  return source;
}

function configureGradle(source) {
  if (!source.includes('native/checkin-call/android')) {
    source = source.replace(/android\s*\{/, '$&\n    sourceSets {\n        main.java.srcDir("../../native/checkin-call/android")\n        main.res.srcDir("../../native/checkin-call/res")\n        test.java.srcDir("../../native/checkin-call/test")\n    }\n    testOptions { unitTests.includeAndroidResources = true }');
  }
  const dependencies = [
    'implementation("com.google.firebase:firebase-messaging:25.0.1")',
    'implementation("androidx.work:work-runtime-ktx:2.10.5")',
    'testImplementation("junit:junit:4.13.2")',
    'testImplementation("org.robolectric:robolectric:4.16.1")',
    'testImplementation("androidx.work:work-testing:2.10.5")',
    'testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")',
  ];
  for (const dependency of dependencies) {
    if (!source.includes(dependency)) source = source.replace(/dependencies\s*\{/, `$&\n    ${dependency}`);
  }
  return source;
}

function withAsinuCheckinCalls(config) {
  config = withAndroidManifest(config, mod => { mod.modResults = configureManifest(mod.modResults); return mod; });
  config = withMainApplication(config, mod => {
    if (mod.modResults.language !== 'kt') throw new Error('Asinu Android requires a Kotlin MainApplication');
    mod.modResults.contents = configureApplication(mod.modResults.contents); return mod;
  });
  return withAppBuildGradle(config, mod => { mod.modResults.contents = configureGradle(mod.modResults.contents); return mod; });
}
module.exports = withAsinuCheckinCalls;
module.exports.configureManifest = configureManifest;
module.exports.configureApplication = configureApplication;
module.exports.configureGradle = configureGradle;
