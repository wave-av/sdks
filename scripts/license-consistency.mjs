#!/usr/bin/env node
/**
 * license-consistency — every publishable package in this monorepo must ship the license
 * text it declares.
 *
 * WHY: on 2026-09-03 all 49 `sdk-typescript/packages/*` manifests declared `Apache-2.0`
 * while the `LICENSE` file sitting beside each of them was the **MIT** text, and so did
 * `sdk-python/` (whose `pyproject.toml` also declares Apache-2.0). npm and PyPI pack the
 * LICENSE from the package directory, so `@wave-av/workflow-sdk@1.0.6` is on the public
 * registry today carrying the MIT text under a source tree that declares Apache-2.0. The
 * repository ROOT LICENSE was Apache-2.0 the whole time — which is exactly why nobody saw
 * it: every check anyone had looked at the root.
 *
 * This gate reads the license TEXT next to each manifest and names it, then requires the
 * declaration to match. Comparing declarations to each other cannot catch this class of
 * defect; only reading the file can.
 *
 * Usage:  node scripts/license-consistency.mjs [--json]
 * Exit 0 when every declared license matches its shipped text; 1 otherwise.
 *
 * Dependency-free on purpose: this repo has no root package.json, so the gate must run
 * with nothing installed.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Name a license from its text. Ordered so Apache's appendix cannot be read as MIT. */
export function detectSpdxFromText(text) {
  if (typeof text !== 'string' || !text.trim()) return 'UNKNOWN';
  if (/apache\s+license\s*\n?\s*version\s+2\.0/i.test(text)) return 'Apache-2.0';
  if (/mozilla public license\s*,?\s*(version\s+)?2\.0/i.test(text)) return 'MPL-2.0';
  if (/\bbsd\b.*\blicense\b/i.test(text) && /neither the name of/i.test(text)) return 'BSD-3-Clause';
  if (/permission to use, copy, modify,? and\/or distribute/i.test(text)) return 'ISC';
  if (/\bmit license\b/i.test(text)) return 'MIT';
  if (/permission is hereby granted, free of charge/i.test(text)) return 'MIT';
  return 'UNKNOWN';
}

/** The license a manifest declares, or null when it declares none. */
export function declaredLicense(manifestPath) {
  const text = readFileSync(manifestPath, 'utf8');
  if (manifestPath.endsWith('.json')) {
    const pkg = JSON.parse(text);
    if (pkg.private === true) return null; // never published
    const l = pkg.license;
    return typeof l === 'string' ? l : l?.type ?? null;
  }
  if (manifestPath.endsWith('.gemspec')) {
    return text.match(/\.license\s*=\s*["']([^"']+)["']/)?.[1] ?? null;
  }
  if (manifestPath.endsWith('pyproject.toml')) {
    return (
      text.match(/^\s*license\s*=\s*\{[^}]*text\s*=\s*["']([^"']+)["']/m)?.[1] ??
      text.match(/^\s*license\s*=\s*["']([^"']+)["']/m)?.[1] ??
      null
    );
  }
  if (manifestPath.endsWith('Cargo.toml')) {
    // Only a crate's own [package] license counts; a workspace Cargo.toml has none.
    return text.match(/^\s*license\s*=\s*["']([^"']+)["']/m)?.[1] ?? null;
  }
  return null;
}

/**
 * The LICENSE that actually travels with a package: the one in its own directory, else the
 * nearest ancestor's — the same lookup npm, pip, cargo and gem effectively perform.
 */
export function nearestLicense(dir) {
  let cur = dir;
  while (cur.startsWith(ROOT)) {
    for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE']) {
      const p = join(cur, name);
      if (existsSync(p)) return p;
    }
    if (cur === ROOT) break;
    cur = dirname(cur);
  }
  return null;
}

const MANIFESTS = /^(package\.json|pyproject\.toml|Cargo\.toml|.*\.gemspec)$/;
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'target', 'vendor', '.venv']);

export function findManifests(dir = ROOT, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const p = join(dir, entry);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) findManifests(p, out);
    else if (MANIFESTS.test(entry)) out.push(p);
  }
  return out;
}

export function audit() {
  const rows = [];
  for (const manifest of findManifests()) {
    const declared = declaredLicense(manifest);
    if (!declared) continue; // private, a workspace root, or declares nothing
    const licensePath = nearestLicense(dirname(manifest));
    const shipped = licensePath ? detectSpdxFromText(readFileSync(licensePath, 'utf8')) : 'MISSING';
    rows.push({
      manifest: relative(ROOT, manifest),
      declared,
      license: licensePath ? relative(ROOT, licensePath) : null,
      shipped,
      ok: shipped === declared,
    });
  }
  rows.sort((a, b) => a.manifest.localeCompare(b.manifest));
  return rows;
}

function main() {
  const rows = audit();
  const bad = rows.filter((r) => !r.ok);

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ rows, failing: bad.length }, null, 2)}\n`);
    return bad.length ? 1 : 0;
  }

  console.log(`license-consistency: checked ${rows.length} publishable packages`);
  if (!bad.length) {
    console.log('OK — every declared license matches the license text shipped beside it.');
    return 0;
  }
  console.error(`\n${bad.length} package(s) declare a license they do not ship:\n`);
  for (const r of bad) {
    console.error(
      `  ${r.manifest}\n` +
        `    declares : ${r.declared}\n` +
        `    ships    : ${r.shipped}${r.license ? ` (${r.license})` : ' — no LICENSE file found'}`
    );
  }
  console.error(
    '\nFix the LICENSE file to match what the manifest already declares. Changing the ' +
      'DECLARATION instead is a relicensing decision and is not a CI fix.'
  );
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
