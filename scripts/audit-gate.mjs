// CI dependency audit gate (KAN-80).
// - Production dependencies: zero vulnerabilities, no exceptions.
// - Full tree: every advisory must be listed in .github/audit-exceptions.json for a dev-only
//   package and not be past its expiry date. Anything else fails, as plain `npm audit` did.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADVISORY_ID = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i;
const ADVISORY_URL =
  /^https:\/\/github\.com\/advisories\/(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})$/i;

const isRealDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const advisoryId = (via) => {
  const match = typeof via?.url === 'string' ? via.url.match(ADVISORY_URL) : null;
  return match ? match[1].toLowerCase() : null;
};

// Returns every advisory (object `via` entry) in an `npm audit --json` report.
export const listAdvisories = (report) => {
  const found = [];
  for (const [name, vulnerability] of Object.entries(report?.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (via && typeof via === 'object') found.push({ package: name, id: advisoryId(via), via });
    }
  }
  return found;
};

export const evaluateAudit = ({ productionReport, fullReport, exceptions, today }) => {
  const problems = [];
  const productionTotal = productionReport?.metadata?.vulnerabilities?.total;
  if (!Number.isInteger(productionTotal)) {
    problems.push('Production audit did not return a vulnerability total.');
  } else if (productionTotal !== 0) {
    problems.push(
      `Production dependencies have ${productionTotal} vulnerabilities; no exceptions apply.`,
    );
  }
  if (!fullReport?.metadata?.vulnerabilities) {
    problems.push('Full audit did not return vulnerability metadata.');
  }
  const allowed = new Map();
  for (const entry of exceptions ?? []) {
    const id = String(entry.advisory ?? '').toLowerCase();
    if (!ADVISORY_ID.test(id) || entry.scope !== 'dev' || !isRealDate(entry.expires)) {
      problems.push(`Malformed exception entry: ${JSON.stringify(entry)}`);
      continue;
    }
    if (entry.expires < today) {
      problems.push(
        `Exception for ${entry.advisory} expired on ${entry.expires}; recheck and remove or renew it.`,
      );
      continue;
    }
    allowed.set(id, entry);
  }
  const tolerated = new Set();
  for (const advisory of listAdvisories(fullReport)) {
    const entry = advisory.id ? allowed.get(advisory.id) : undefined;
    if (!entry || entry.package !== advisory.package) {
      problems.push(
        `Unlisted advisory ${advisory.id ?? advisory.via?.url ?? 'without id'} in ${advisory.package} (${advisory.via?.severity ?? 'unknown'}).`,
      );
    } else {
      tolerated.add(entry.advisory);
    }
  }
  // Every vulnerable package must trace (through string `via` links) to a listed advisory, and
  // the package count must match npm's total, so a partial or odd report cannot pass silently.
  const vulnerabilities = fullReport?.vulnerabilities ?? {};
  const reachesAdvisory = (name, seen = new Set()) => {
    if (seen.has(name)) return false;
    seen.add(name);
    return (vulnerabilities[name]?.via ?? []).some((via) =>
      via && typeof via === 'object' ? true : typeof via === 'string' && reachesAdvisory(via, seen),
    );
  };
  for (const name of Object.keys(vulnerabilities)) {
    if (!reachesAdvisory(name))
      problems.push(`Vulnerable package ${name} has no traceable advisory.`);
  }
  const fullTotal = fullReport?.metadata?.vulnerabilities?.total;
  if (Number.isInteger(fullTotal) && fullTotal !== Object.keys(vulnerabilities).length) {
    problems.push(
      `Full audit total (${fullTotal}) does not match its ${Object.keys(vulnerabilities).length} listed packages.`,
    );
  }
  return { ok: problems.length === 0, problems, tolerated: [...tolerated] };
};

const runAudit = (args) => {
  try {
    return JSON.parse(
      execFileSync('npm', ['audit', '--json', ...args], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      }),
    );
  } catch (error) {
    // npm audit exits 1 when it finds vulnerabilities; its JSON is still on stdout.
    if (error && typeof error.stdout === 'string' && error.stdout.trim())
      return JSON.parse(error.stdout);
    throw error;
  }
};

const main = () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { exceptions } = JSON.parse(
    readFileSync(resolve(root, '.github/audit-exceptions.json'), 'utf8'),
  );
  const result = evaluateAudit({
    productionReport: runAudit(['--omit=dev']),
    fullReport: runAudit([]),
    exceptions,
    today: new Date().toISOString().slice(0, 10),
  });
  if (!result.ok) {
    for (const problem of result.problems) console.error(problem);
    process.exitCode = 1;
    return;
  }
  console.log('Production dependencies: 0 vulnerabilities.');
  if (result.tolerated.length) {
    console.log(
      `Development-only advisories under a dated exception: ${result.tolerated.join(', ')}.`,
    );
  } else {
    console.log('Full audit: 0 vulnerabilities.');
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
