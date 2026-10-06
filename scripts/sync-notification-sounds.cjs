/** Import the supplied pack, or sync checked-in assets without regenerating music. */
const fs = require('node:fs');
const path = require('node:path');
const xcode = require('xcode');
const manifest = require('../src/config/notification-sounds.json');
const { syncAndroidSounds, syncIOSSounds } = require('../plugins/withAsinuNotificationSounds');
const projectRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

if (args.length && (args.length !== 2 || args[0] !== '--import')) {
  throw new Error('Usage: node scripts/sync-notification-sounds.cjs [--import <pack-directory>]');
}
if (args.length) {
  const packRoot = path.resolve(args[1]);
  const copies = ['ios', 'android'].flatMap((platform) =>
    Object.values(manifest.sounds).map((sound) => ({
      source: path.join(packRoot, platform === 'ios' ? 'ios_caf' : 'android_ogg', sound[platform]),
      destination: path.join(projectRoot, 'assets/sounds', platform, sound[platform]),
    }))
  );
  // Validate every input before overwriting any of the explicitly scoped assets.
  for (const { source } of copies) {
    if (!fs.statSync(source).isFile()) {
      throw new Error(`Missing sound: ${source}`);
    }
  }
  for (const { source, destination } of copies) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
}

syncAndroidSounds(projectRoot);
const projectFile = path.join(projectRoot, 'ios/Asinu.xcodeproj/project.pbxproj');
const project = xcode.project(projectFile);
project.parseSync();
syncIOSSounds(projectRoot, project, 'Asinu');
const original = fs.readFileSync(projectFile, 'utf8');
const updated = project.writeSync();
if (updated !== original) {
  fs.writeFileSync(projectFile, updated);
}
console.log('Synced warm notification pack: 5 iOS CAF + 5 Android OGG; legacy sounds retained.');
