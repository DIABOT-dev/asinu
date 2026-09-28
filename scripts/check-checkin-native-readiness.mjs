import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const checks = [];

const expectText = (relativePath, expected, label) => {
  const present = read(relativePath).includes(expected);
  checks.push({ label, present });
};

expectText('app.json', '"AsinuAPNSEnvironment": "$(APS_ENVIRONMENT)"', 'Expo APNs environment follows build configuration');
expectText('ios/Asinu/Info.plist', '<string>$(APS_ENVIRONMENT)</string>', 'iOS Info.plist follows APS_ENVIRONMENT');
expectText('ios/Asinu.xcodeproj/project.pbxproj', 'APS_ENVIRONMENT = development;', 'iOS Debug uses APNs sandbox');
expectText('ios/Asinu.xcodeproj/project.pbxproj', 'APS_ENVIRONMENT = production;', 'iOS Release uses APNs production');
expectText('ios/Asinu/Asinu.entitlements', '<key>aps-environment</key>', 'iOS push entitlement exists');
expectText('ios/Asinu/Info.plist', '<string>voip</string>', 'iOS VoIP background mode exists');
expectText('ios/Asinu/VoipCallManager.swift', 'PKPushRegistryDelegate', 'PushKit manager is compiled');
expectText('ios/Asinu/VoipCallManager.swift', 'CXProviderDelegate', 'CallKit provider is compiled');
expectText('ios/Asinu/VoipCallManager.swift', 'SecTaskCopyValueForEntitlement', 'PushKit reports the signed APNs environment');
expectText('android/app/src/main/AndroidManifest.xml', 'android.permission.POST_NOTIFICATIONS', 'Android notification permission exists');
expectText('android/app/src/main/AndroidManifest.xml', 'android.permission.USE_FULL_SCREEN_INTENT', 'Android full-screen intent permission exists');
expectText('android/app/src/main/AndroidManifest.xml', '.notifications.AsinuFirebaseMessagingService', 'Android native FCM service is registered');
expectText('android/app/src/main/java/com/asinu/lite/notifications/AsinuFirebaseMessagingService.kt', 'setFullScreenIntent', 'Android incoming call uses a full-screen intent');
checks.push({
  label: 'Firebase Android configuration exists',
  present: fs.existsSync(path.join(root, 'android/app/google-services.json')),
});

for (const check of checks) {
  console.log(`${check.present ? 'PASS' : 'FAIL'} ${check.label}`);
}

const failed = checks.filter((check) => !check.present);
if (failed.length) {
  console.error(`Check-in native readiness failed: ${failed.length} check(s).`);
  process.exit(1);
}
console.log(`Check-in native readiness passed: ${checks.length}/${checks.length}.`);
