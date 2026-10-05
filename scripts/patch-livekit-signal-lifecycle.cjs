'use strict';

// LiveKit 2.22.3 logs a signal-reader error before checking whether its
// transport was deliberately closed or replaced. RN surfaces that late error
// as a red LogBox after a successful call. Patch source and BOTH runtime entry
// points: React Native uses UMD, while import consumers use ESM. Keep genuine
// connected/offline transport failures and the SDK reconnect path unchanged.
const fs = require('node:fs');
const path = require('node:path');

const marker = 'ignoring signal stream error from a closed or replaced connection';
const sdkRoot = path.resolve(path.dirname(require.resolve('livekit-client')), '..');
const version = JSON.parse(fs.readFileSync(path.join(sdkRoot, 'package.json'), 'utf8')).version;
if (version !== '2.22.3') {
  throw new Error(`Review the LiveKit lifecycle patch before installing SDK ${version}.`);
}

const patches = [
  {
    file: 'src/api/SignalClient.ts',
    before: '        this.log.error(`error reading from signal stream`, { error: e });',
    after: `        if (
          attemptId !== this.attemptId ||
          this.lifecycleState === 'disconnecting' ||
          this.lifecycleState === 'closed'
        ) {
          this.log.debug('${marker}', { error: e });
          break;
        }
        this.log.error(\`error reading from signal stream\`, { error: e });`,
  },
  {
    file: 'dist/livekit-client.esm.mjs',
    before: '          this.log.error("error reading from signal stream", {',
    after: `          if (attemptId !== this.attemptId || this.lifecycleState === 'disconnecting' || this.lifecycleState === 'closed') {
            this.log.debug('${marker}', { error: e });
            break;
          }
          this.log.error("error reading from signal stream", {`,
  },
  {
    file: 'dist/livekit-client.umd.js',
    before: 'catch(n){this.log.error("error reading from signal stream",{error:n}),yield this.handleOnClose("error in reading loop",i);break}',
    after: `catch(n){if(i!==this.attemptId||this.lifecycleState==="disconnecting"||this.lifecycleState==="closed"){this.log.debug("${marker}",{error:n});break}this.log.error("error reading from signal stream",{error:n}),yield this.handleOnClose("error in reading loop",i);break}`,
  },
];

// Validate every target before any rewrite, rather than half-patching an SDK
// whose upstream bundle has changed. Running postinstall twice is safe.
const changes = patches.map(({ file, before, after }) => {
  const absolute = path.join(sdkRoot, file);
  const source = fs.readFileSync(absolute, 'utf8');
  if (source.includes(after)) {
    return { absolute, file, source, patched: false };
  }
  if (source.includes(marker) || source.split(before).length !== 2) {
    throw new Error(`Unexpected LiveKit code in ${file}; refusing a partial patch.`);
  }
  return { absolute, file, source: source.replace(before, after), patched: true };
});
for (const change of changes) {
  if (change.patched) {
    fs.writeFileSync(change.absolute, change.source);
  }
}
console.log(`LiveKit signal lifecycle fix: ${changes.filter(change => change.patched).length} runtime/source files updated (SDK ${version}).`);
