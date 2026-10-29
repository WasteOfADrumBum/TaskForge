# deepmerge 4.3.2 (local patch)

This is the published [`deepmerge@4.3.1`](https://www.npmjs.com/package/deepmerge) CommonJS build with a local fix for [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) (CVE-2026-93753). It is not an upstream release. The npm registry still ends at 4.3.1, and that advisory lists no patched version.

`jest-config` merges Jest configuration with this package. The root depends on `file:vendor/deepmerge` and the `overrides` entry `"deepmerge": "$deepmerge"` forces every copy onto that dependency. The lockfile version is `4.3.2`, which is outside the advisory range `>=4.2.0 <=4.3.1`, and the resolved URL is this directory rather than the vulnerable tarball.

The patch, in `dist/cjs.js`:

- skips own keys named `__proto__`, `constructor`, or `prototype` while copying the target and the source
- writes merged values with `Object.defineProperty` so the `__proto__` setter never runs
- treats a throwing `in` check as unsafe and drops that key

Ordinary nested objects, arrays, and `deepmerge.all` keep the 4.3.1 behavior. Downgrading below 4.2.0 is not a fix: 4.1.2 still assigns `__proto__` onto the returned object for a plain target. `npm audit fix --force` would also downgrade Jest to 25 and bring back dependencies removed in KAN-1.

Delete this directory and point the override at a published release when one exists outside the advisory range. `scripts/deepmerge-override.test.mjs` checks the installed copy.
