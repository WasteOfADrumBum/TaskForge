import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { evaluateAudit, listAdvisories } from './audit-gate.mjs';

const clean = { metadata: { vulnerabilities: { total: 0 } }, vulnerabilities: {} };
const picomatch = {
  metadata: { vulnerabilities: { high: 2, total: 2 } },
  vulnerabilities: {
    picomatch: {
      via: [{ url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf', severity: 'high' }],
    },
    jest: { via: ['picomatch'] },
  },
};
const exception = {
  advisory: 'GHSA-fc5q-39xc-vjpf',
  package: 'picomatch',
  scope: 'dev',
  expires: '2026-12-18',
};

test('tolerates a listed dev-only advisory before its expiry', () => {
  const result = evaluateAudit({
    productionReport: clean,
    fullReport: picomatch,
    exceptions: [exception],
    today: '2026-11-18',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.tolerated, ['GHSA-fc5q-39xc-vjpf']);
});

test('fails on any production vulnerability, even one with an exception', () => {
  const result = evaluateAudit({
    productionReport: picomatch,
    fullReport: picomatch,
    exceptions: [exception],
    today: '2026-11-18',
  });
  assert.equal(result.ok, false);
  assert.match(result.problems[0], /Production dependencies have 2 vulnerabilities/);
});

test('fails once the exception has expired', () => {
  const result = evaluateAudit({
    productionReport: clean,
    fullReport: picomatch,
    exceptions: [exception],
    today: '2026-12-19',
  });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((problem) => /expired on 2026-12-18/.test(problem)));
});

test('fails on an unlisted advisory, or a listed one in another package', () => {
  const other = structuredClone(picomatch);
  other.vulnerabilities.micromatch = {
    via: [{ url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', severity: 'moderate' }],
  };
  const moved = {
    ...clean,
    vulnerabilities: {
      'not-picomatch': {
        via: [{ url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf', severity: 'high' }],
      },
    },
  };
  for (const fullReport of [other, moved]) {
    const result = evaluateAudit({
      productionReport: clean,
      fullReport,
      exceptions: [exception],
      today: '2026-11-18',
    });
    assert.equal(result.ok, false);
    assert.match(result.problems.join('\n'), /Unlisted advisory/);
  }
});

test('rejects malformed exceptions and missing audit output', () => {
  const result = evaluateAudit({
    productionReport: {},
    fullReport: {},
    exceptions: [
      { ...exception, scope: 'prod' },
      { ...exception, expires: 'soon' },
    ],
    today: '2026-11-18',
  });
  assert.equal(result.ok, false);
  assert.equal(result.problems.filter((p) => /Malformed exception/.test(p)).length, 2);
  assert.ok(result.problems.some((p) => /Production audit did not return/.test(p)));
  assert.ok(result.problems.some((p) => /Full audit did not return/.test(p)));
});

test('the committed exception list is well formed and dev-only', () => {
  const { exceptions } = JSON.parse(
    readFileSync(new URL('../.github/audit-exceptions.json', import.meta.url), 'utf8'),
  );
  assert.ok(Array.isArray(exceptions));
  for (const entry of exceptions) {
    assert.equal(entry.scope, 'dev');
    assert.match(entry.expires, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(entry.advisory, /^GHSA-/);
    assert.ok(entry.reason && entry.approved);
  }
  assert.equal(listAdvisories(clean).length, 0);
});

test('fails on a package with no traceable advisory or a total that does not match', () => {
  const stringsOnly = {
    metadata: { vulnerabilities: { total: 2 } },
    vulnerabilities: { jest: { via: ['picomatch'] }, lodash: { via: [] } },
  };
  const mismatch = structuredClone(picomatch);
  mismatch.metadata.vulnerabilities.total = 5;
  for (const fullReport of [stringsOnly, mismatch]) {
    const result = evaluateAudit({
      productionReport: clean,
      fullReport,
      exceptions: [exception],
      today: '2026-11-18',
    });
    assert.equal(result.ok, false);
  }
});

test('accepts only GitHub advisory URLs and real calendar dates', () => {
  const lookalike = structuredClone(picomatch);
  lookalike.vulnerabilities.picomatch.via[0].url = 'https://evil.example/GHSA-fc5q-39xc-vjpf';
  assert.equal(
    evaluateAudit({
      productionReport: clean,
      fullReport: lookalike,
      exceptions: [exception],
      today: '2026-11-18',
    }).ok,
    false,
  );
  const badDate = evaluateAudit({
    productionReport: clean,
    fullReport: picomatch,
    exceptions: [{ ...exception, expires: '2026-13-45' }],
    today: '2026-11-18',
  });
  assert.ok(badDate.problems.some((p) => /Malformed exception/.test(p)));
});
