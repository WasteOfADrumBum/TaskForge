import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const deepmerge = require(require.resolve('deepmerge', { paths: [root] }));

function mergedPrototype(result) {
  const prototype = Object.getPrototypeOf(result);
  return {
    prototype,
    inheritedAdmin: Boolean(result.isAdmin),
    ownAdmin: Object.prototype.hasOwnProperty.call(result, 'isAdmin'),
    globalAdmin: Object.prototype.isAdmin === true,
  };
}

test('the installed deepmerge is the local GHSA-gcqx-w48m-w2h4 patch', () => {
  const installed = require.resolve('deepmerge', { paths: [root] });
  assert.match(installed, /vendor\/deepmerge\/dist\/cjs\.js$/);
  assert.equal(deepmerge.all([{ keep: 1 }, { extra: 2 }]).extra, 2);
});

test('a __proto__ key does not change the prototype of the returned object', () => {
  const payload = JSON.parse('{"__proto__":{"isAdmin":true}}');
  const withSession = deepmerge({ session: null, name: 'taskforge' }, payload);
  const cases = [
    deepmerge({}, payload),
    deepmerge(Object.create(null), payload),
    withSession,
    deepmerge(JSON.parse('{"__proto__":{}}'), payload),
    deepmerge.all([{}, payload]),
    deepmerge({ nested: {} }, JSON.parse('{"nested":{"__proto__":{"isAdmin":true}}}')).nested,
  ];

  assert.equal(withSession.session, null);
  assert.equal(withSession.name, 'taskforge');

  for (const result of cases) {
    const state = mergedPrototype(result);
    assert.equal(state.inheritedAdmin, false);
    assert.equal(state.ownAdmin, false);
    assert.equal(state.globalAdmin, false);
    assert.ok(state.prototype === Object.prototype || state.prototype === null);
  }
});

test('constructor and prototype keys are not copied onto the result', () => {
  const result = deepmerge(
    { name: 'taskforge' },
    JSON.parse('{"constructor":{"prototype":{"isAdmin":true}},"prototype":{"isAdmin":true}}'),
  );
  assert.equal(Object.hasOwn(result, 'constructor'), false);
  assert.equal(Object.hasOwn(result, 'prototype'), false);
  assert.equal(result.isAdmin, undefined);
  assert.equal(result.name, 'taskforge');
  assert.equal(Object.prototype.isAdmin, undefined);
});

test('ordinary Jest-style config merges still combine nested objects and arrays', () => {
  const merged = deepmerge.all([
    { testMatch: ['**/*.test.ts'], globals: { env: 'test' }, verbose: false },
    { testMatch: ['server/**/*.test.ts'], globals: { env: 'integration' }, verbose: true },
  ]);
  assert.deepEqual(merged.testMatch, ['**/*.test.ts', 'server/**/*.test.ts']);
  assert.deepEqual(merged.globals, { env: 'integration' });
  assert.equal(merged.verbose, true);
});
