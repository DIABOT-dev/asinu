import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync('src/features/checkin-call/checkin-call.state.ts', 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
// Only evaluate the local pure state helpers; the API import is type-only.
// eslint-disable-next-line no-new-func
new Function('module', 'exports', output)(module, module.exports);
const { isCheckinCallAttemptClosed, getFamilyCallNoticeKeys, getClosedCheckinCallStatusKey } = module.exports;
let checks = 0;

for (const [severity, label] of [
  ['UNKNOWN', 'unknown'], ['NONE', 'unknown'], [null, 'unknown'],
  [undefined, 'unknown'], ['MILD', 'mild'], ['URGENT', 'urgent'],
]) {
  const keys = getFamilyCallNoticeKeys(severity);
  assert.deepEqual(keys, {
    titleKey: `gallery.${label}FamilyTitle`, messageKey: `gallery.${label}FamilyMessage`,
  });
  for (const language of ['vi', 'en']) {
    const catalog = JSON.parse(fs.readFileSync(`src/i18n/locales/${language}/checkinCall.json`, 'utf8'));
    for (const key of Object.values(keys)) {
      assert.ok(catalog.gallery[key.split('.')[1]], `${language}: missing ${key}`);
    }
  }
  checks += 1;
}
for (const state of ['NO_ANSWER', 'CANCELLED', 'EXPIRED', 'COMPLETED']) {
  assert.equal(isCheckinCallAttemptClosed({ state, episode_state: 'MILD_FAMILY_ESCALATION' }), true);
  checks += 1;
}
for (const episode_state of ['RESOLVED', 'EXHAUSTED', 'EXHAUSTED_MILD', 'EXHAUSTED_URGENT', 'CANCELLED']) {
  assert.equal(isCheckinCallAttemptClosed({ state: 'CONNECTED', episode_state }), true);
  checks += 1;
}
for (const [state, episode_state] of [
  ['RINGING', 'CONTACT_USER'], ['CONNECTED', 'TRIAGE_USER'],
  ['PUSH_WAIT', 'MILD_FAMILY_ESCALATION'], ['CONNECTED', 'URGENT_ACKNOWLEDGED'],
]) {
  assert.equal(isCheckinCallAttemptClosed({ state, episode_state }), false);
  checks += 1;
}
const screen = fs.readFileSync('app/checkin-call/[episodeId].tsx', 'utf8');
for (const [state, episode_state, target_role, severity, expected] of [
  ['COMPLETED', 'RESOLVED', 'USER', 'NONE', 'statusUserOk'],
  ['COMPLETED', 'RESOLVED', 'FAMILY', 'UNKNOWN', 'statusFamilyConfirmed'],
  ['COMPLETED', 'RESOLVED', 'FAMILY', 'URGENT', 'statusFamilyConfirmed'],
  ['COMPLETED', 'MILD_FAMILY_ESCALATION', 'USER', 'MILD', 'statusUserMild'],
  ['COMPLETED', 'URGENT_BROADCAST', 'USER', 'URGENT', 'statusUserUrgent'],
  ['COMPLETED', 'EXHAUSTED', 'USER', 'MILD', 'statusFamilyUnavailable'],
  ['COMPLETED', 'EXHAUSTED_MILD', 'USER', 'MILD', 'statusFamilyUnavailable'],
  ['COMPLETED', 'EXHAUSTED_URGENT', 'USER', 'URGENT', 'statusFamilyUnavailable'],
  ['NO_ANSWER', 'MILD_FAMILY_ESCALATION', 'USER', 'UNKNOWN', 'statusEnded'],
  ['CANCELLED', 'CANCELLED', 'USER', 'NONE', 'statusEnded'],
  ['EXPIRED', 'EXHAUSTED', 'FAMILY', 'UNKNOWN', 'statusEnded'],
]) {
  assert.equal(getClosedCheckinCallStatusKey({ state, episode_state, target_role, severity }), expected);
  checks += 1;
}
assert.ok(/isCheckinCallAttemptClosed\(result\.attempt\)/.test(screen), 'Initial load must close expired attempts');
assert.ok(/isCheckinCallAttemptClosed\(latest\)/.test(screen), 'Polling must close expired attempts');
assert.ok(/t\(familyNotice\.titleKey\)/.test(screen), 'Family title must use its severity-specific locale key');
assert.ok(/t\(familyNotice\.messageKey\)/.test(screen), 'Family message must use its severity-specific locale key');
assert.ok(screen.includes('room={room.instance}'), 'The screen must own the exact LiveKit room it disconnects');
assert.ok(screen.includes('onError={onConnectionError}'), 'Room callback identity must not change on every screen render');
assert.ok(screen.includes('if (!live || connectionEnding.current || actionPending.current) return;'), 'Late poll responses must not replace a completed result or an in-flight response');
assert.ok(screen.includes('activeRoom.current?.instance === room?.instance'), 'Old room callbacks must not affect a replacement room');
for (const method of ['answer', 'completeTriage', 'confirmFamily']) {
  const actionAt = screen.indexOf(`checkinCallApi.${method}(`);
  const closeAt = screen.lastIndexOf('await disconnectRoom();', actionAt);
  assert.ok(closeAt >= 0 && actionAt - closeAt < 250, `${method}: signaling must close before backend/native call teardown`);
}
for (const file of ['app/checkin-call/[episodeId].tsx', 'app/checkin-call/ui-gallery.tsx']) {
  const ui = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, ui, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const actionGroups = [];
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attribute =>
      ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'style' &&
      attribute.initializer && attribute.initializer.getText(ast) === '{styles.familyActionsCol}'
    ) && node.getText(ast).includes("t('confirmCheck')")) {
      actionGroups.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(actionGroups.length, 1, `${file}: expected one family confirmation group`);
  const actions = actionGroups[0].children.filter(ts.isJsxElement);
  assert.equal(actions.length, 1, `${file}: family calls must only offer one confirmation action`);
  assert.ok(actions[0].getText(ast).includes("t('confirmCheck')"), `${file}: keep the accept-and-check label`);
  assert.ok(!ui.includes("t('confirmOnMyWay')") && !ui.includes("t('confirmCalled')"), `${file}: remove duplicate actions`);
  checks += 1;
}
assert.ok(screen.includes("checkinCallApi.confirmFamily(episodeId, 'ACCEPT_AND_CHECK')"), 'The single action must retain backend confirmation semantics');
checks += 1;
const contact = fs.readFileSync('src/features/checkin-call/CheckinCallContact.tsx', 'utf8');
for (const field of ['subject.name', 'subject.relationship', 'subject.phone_number']) {
  assert.ok(contact.includes(field), `Family contact must show ${field}`);
  checks += 1;
}
assert.equal((screen.match(/<CheckinCallContact subject=\{attempt.subject\}/g) || []).length, 3, 'Identify the protected person before, during and after the family call');
const audioAdapter = fs.readFileSync('src/features/checkin-call/useCheckinCallAudio.ts', 'utf8');
assert.ok(audioAdapter.includes('checkinCallApi.familyAudio(prompt.attemptId!)'), 'Family TTS must be authorized for the exact captured attempt');
assert.ok(audioAdapter.includes('current.attempt?.family_notice?.audio_text'), 'Device fallback must preserve personalized identity');
assert.ok(audioAdapter.includes("personalizedFamily ? prompt.attemptId + '-'"), 'Do not reuse another person’s cached audio');
assert.ok(!contact.includes('numberOfLines') && !contact.includes('height:'), 'Contact details must wrap at large font sizes');
checks += 5;
console.log(`Check-in call UI state: ${checks} regression checks passed; screen uses the tested helpers.`);
