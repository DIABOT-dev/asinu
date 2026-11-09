import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function harness() {
  let cursor = 0,
    frame = 0,
    keyboardVisible = true,
    dismissed = 0;
  const slots = [],
    effects = [],
    frames = new Map(),
    listeners = new Map(),
    scrolls = [];
  const hooks = {
    useRef(initial) {
      const id = cursor++;
      return (slots[id] ??= { current: initial });
    },
    useCallback(work, deps) {
      const id = cursor++,
        old = slots[id];
      if (!old || deps.some((v, i) => !Object.is(v, old.deps[i]))) {
        slots[id] = { value: work, deps };
      }
      return slots[id].value;
    },
    useEffect(work, deps) {
      const id = cursor++,
        old = slots[id];
      if (!old || deps.some((v, i) => !Object.is(v, old.deps[i]))) {
        slots[id] = { deps };
        effects.push(() => {
          old?.cleanup?.();
          slots[id].cleanup = work();
        });
      }
    },
  };
  const code = ts.transpileModule(
    fs.readFileSync(
      'src/features/checkin/useCheckinQuestionViewport.ts',
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func -- Exercise the production hook with native layout/keyboard ordering.
  new Function(
    'module',
    'exports',
    'require',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    code,
  )(
    module,
    module.exports,
    (id) => {
      if (id === 'react') {
        return hooks;
      }
      assert.equal(id, 'react-native');
      return {
        Keyboard: {
          isVisible: () => keyboardVisible,
          dismiss: () => {
            dismissed++;
          },
          addListener: (event, callback) => {
            listeners.set(event, callback);
            return { remove: () => listeners.delete(event) };
          },
        },
      };
    },
    (callback) => {
      frames.set(++frame, callback);
      return frame;
    },
    (id) => frames.delete(id),
  );
  const ref = { current: { scrollTo: (value) => scrolls.push(value) } };
  return {
    scrolls,
    frames,
    listeners,
    render(question = 'q1', enabled = true, loading = false) {
      cursor = 0;
      const value = module.exports.useCheckinQuestionViewport(
        ref,
        question,
        enabled,
        loading,
      );
      effects.splice(0).forEach((work) => work());
      return value;
    },
    layoutFrame() {
      const queued = [...frames];
      frames.clear();
      queued.forEach(([, callback]) => callback());
    },
    keyboardHidden() {
      keyboardVisible = false;
      listeners.get('keyboardDidHide')?.();
    },
    get dismissed() {
      return dismissed;
    },
    cleanup() {
      slots.forEach((slot) => slot?.cleanup?.());
    },
  };
}

test('new question resets after content layout and subsequent native frames, never to the bottom', () => {
  const h = harness();
  try {
    const view = h.render('q2');
    view.onContentSizeChange();
    h.layoutFrame();
    h.layoutFrame();
    assert.ok(h.scrolls.length >= 3);
    assert.ok(
      h.scrolls.every((value) => value.y === 0 && value.animated === false),
    );
    assert.equal(h.frames.size, 0);
  } finally {
    h.cleanup();
  }
});
test('toggling an option or growing an input on the same question does not scroll or dismiss typing', () => {
  const h = harness();
  try {
    h.render();
    h.layoutFrame();
    h.layoutFrame();
    const count = h.scrolls.length,
      dismissed = h.dismissed;
    h.render().onContentSizeChange();
    assert.equal(h.scrolls.length, count);
    assert.equal(h.dismissed, dismissed);
  } finally {
    h.cleanup();
  }
});
test('late keyboard dismissal after the answer cannot move the next question back down', () => {
  const h = harness();
  try {
    h.render();
    h.layoutFrame();
    h.layoutFrame();
    const count = h.scrolls.length;
    h.keyboardHidden();
    assert.equal(h.scrolls.length, count + 1);
    assert.deepEqual(h.scrolls.at(-1), { y: 0, animated: false });
    h.keyboardHidden();
    assert.equal(h.scrolls.length, count + 1);
  } finally {
    h.cleanup();
  }
});
test('a deliberate user drag cancels automatic correction and its pending frames', () => {
  const h = harness();
  try {
    const view = h.render();
    view.onScrollBeginDrag();
    const count = h.scrolls.length;
    h.layoutFrame();
    view.onContentSizeChange();
    h.keyboardHidden();
    assert.equal(h.scrolls.length, count);
    assert.equal(h.frames.size, 0);
  } finally {
    h.cleanup();
  }
});
test('loading, retry and a new question each get a fresh layout reset', () => {
  const h = harness();
  try {
    for (const [question, loading] of [
      ['q1', false],
      ['q1', true],
      ['q2', false],
      ['q2', true],
    ]) {
      h.render(question, true, loading);
      h.layoutFrame();
      h.layoutFrame();
    }
    assert.equal(h.scrolls.length, 8);
    assert.ok(h.scrolls.every((s) => s.y === 0));
  } finally {
    h.cleanup();
  }
});
test('tutorial scrolling is unaffected and unmount releases all native work', () => {
  const h = harness();
  h.render('q1', false);
  assert.equal(h.dismissed, 0);
  assert.equal(h.frames.size, 0);
  assert.equal(h.listeners.size, 0);
  h.render();
  assert.ok(h.frames.size);
  assert.ok(h.listeners.size);
  h.cleanup();
  assert.equal(h.frames.size, 0);
  assert.equal(h.listeners.size, 0);
});
