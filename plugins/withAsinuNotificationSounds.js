const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const manifest = require('../src/config/notification-sounds.json');

function soundPaths(platform) {
  return Object.values(manifest.sounds).map((sound) =>
    path.join('assets', 'sounds', platform, sound[platform])
  );
}

function syncAndroidSounds(projectRoot) {
  const destination = path.join(projectRoot, 'android/app/src/main/res/raw');
  fs.mkdirSync(destination, { recursive: true });
  for (const relative of soundPaths('android')) {
    const filename = path.basename(relative);
    // CAF and OGG with the same basename cannot both be Android resources.
    const resourceName = path.parse(filename).name;
    const collision = fs.readdirSync(destination).find((file) =>
      path.parse(file).name === resourceName && file !== filename
    );
    if (collision) {
      throw new Error(`Duplicate notification resource: ${collision} / ${filename}`);
    }
    fs.copyFileSync(path.join(projectRoot, relative), path.join(destination, filename));
  }
}

function syncIOSSounds(projectRoot, project, projectName) {
  if (!projectName) {
    throw new Error('iOS project name is required to bundle Asinu sounds');
  }
  const destination = IOSConfig.Paths.getSourceRoot(projectRoot);
  for (const relative of soundPaths('ios')) {
    const filename = path.basename(relative);
    fs.copyFileSync(path.join(projectRoot, relative), path.join(destination, filename));
    const filepath = `${projectName}/${filename}`;
    if (!project.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath, groupName: projectName, isBuildFile: true, project,
      });
    }
  }
  return project;
}

/** Keep CAF out of Android raw/ and OGG out of the iOS notification bundle. */
function withAsinuNotificationSounds(config) {
  config = withXcodeProject(config, (mod) => {
    mod.modResults = syncIOSSounds(
      mod.modRequest.projectRoot, mod.modResults, mod.modRequest.projectName
    );
    return mod;
  });
  return withDangerousMod(config, ['android', async (mod) => {
    syncAndroidSounds(mod.modRequest.projectRoot);
    return mod;
  }]);
}

module.exports = withAsinuNotificationSounds;
module.exports.syncAndroidSounds = syncAndroidSounds;
module.exports.syncIOSSounds = syncIOSSounds;
