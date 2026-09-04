#!/usr/bin/env node
/**
 * registry-cleanroom — GA acceptance for what the PUBLIC REGISTRIES actually serve.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every artifact regression in the pre-GA audit reached users while CI was green, because CI was
 * testing the repository and the registry was serving something else. A green source branch cannot
 * certify a package already published to npm or PyPI. This suite therefore never reads the
 * checkout: it installs from the public registry into a throwaway directory or venv, with no repo
 * on any module path, no `npm link`, no `pip install -e`, and a freshly generated npm user-config
 * so a developer's scoped-registry override or auth token cannot leak in.
 *
 * It is built to FAIL when the registry is broken. A green run against a broken registry is the one
 * outcome worse than having no suite at all.
 *
 * OUTPUT
 *   <out>/cleanroom-report.json  full detail: resolved versions, digests, per-check results
 *   <out>/ga-evidence.json       WAVE-GA-gate-spec-v1.0.0 evidence fragment, keyed by criterion
 *
 * EXIT CODES
 *   0  every check of every selected target passed
 *   1  the gate ran and something failed        (a real artifact defect)
 *   2  the gate could not run                   (never to be read as a pass)
 *
 * USAGE
 *   node scripts/ga/registry-cleanroom.mjs [--out-dir DIR] [--only id,id] [--python EXE]
 *                                          [--versions '@wave-av/cli=1.0.9,wave-sdk=2.1.0']
 * `--versions` (or CLEANROOM_VERSIONS) pins the exact published version to accept, which is how
 * the release job tests the versions it just published instead of whatever `latest` points at.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runNpmTarget, runPypiTarget } from './cleanroom-targets.mjs';
import { bad, run } from './cleanroom-util.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

function parseVersionPins(sink, raw) {
  for (const pair of String(raw).split(',')) {
    const eq = pair.lastIndexOf('=');
    const key = eq > 0 ? pair.slice(0, eq).trim() : '';
    if (key && !(key in sink)) sink[key] = pair.slice(eq + 1).trim();
  }
}

function parseArgs(argv) {
  const out = {
    outDir: join(REPO_ROOT, 'ga-out'),
    only: null,
    python: process.env.CLEANROOM_PYTHON || 'python3',
    versions: {},
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--out-dir') out.outDir = resolve(argv[++i]);
    else if (a === '--only') out.only = new Set(argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--python') out.python = argv[++i];
    else if (a === '--versions') parseVersionPins(out.versions, argv[++i]);
    else throw new Error(`unknown argument: ${a}`);
  }
  if (process.env.CLEANROOM_VERSIONS) parseVersionPins(out.versions, process.env.CLEANROOM_VERSIONS);
  return out;
}

/**
 * Fold per-check results into per-criterion evidence. Structural checks (install/download/venv)
 * carry no explicit mapping and belong to ART-001: an artifact that will not install has failed
 * "published artifacts install" by definition.
 */
function buildEvidence(spec, results, revision) {
  const map = spec.criteria_map || {};
  const byCriterion = new Map();
  for (const r of results) {
    for (const c of r.checks) {
      for (const id of map[c.name] || ['ART-001']) {
        if (!byCriterion.has(id)) byCriterion.set(id, []);
        byCriterion.get(id).push({ package: `${r.package}@${r.version}`, check: c.name, ok: c.ok, detail: c.detail });
      }
    }
  }

  // Fingerprint deliberately excludes timestamps, temp paths and durations, per the gate spec's
  // idempotency rules: two runs observing the same artifacts must produce the same digest.
  const fingerprint = createHash('sha256').update(JSON.stringify(
    results
      .map((r) => ({
        id: r.id,
        package: r.package,
        version: r.version,
        digest: r.integrity || r.artifact?.sha256 || null,
        checks: r.checks.map((c) => [c.name, c.ok]).sort(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  )).digest('hex');

  const verifiedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return {
    fingerprint,
    verifiedAt,
    evidence: {
      spec_version: spec.spec_version || '1.0.0',
      repository: spec.repository || 'wave-av/sdks',
      revision,
      results: [...byCriterion.keys()].sort().map((id) => {
        const rows = byCriterion.get(id);
        const failures = rows.filter((r) => !r.ok);
        return {
          criterion_id: id,
          status: failures.length === 0 ? 'pass' : 'fail',
          command: 'node scripts/ga/registry-cleanroom.mjs',
          evidence_sha256: fingerprint,
          evidence_uri: 'ci://wave-av/sdks/.github/workflows/registry-cleanroom.yml#cleanroom-report.json',
          verified_at: verifiedAt,
          targets_observed: [...new Set(rows.map((r) => r.package))].sort(),
          failing_checks: failures.map((f) => `${f.package}: ${f.check} — ${f.detail}`),
        };
      }),
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const spec = JSON.parse(readFileSync(join(HERE, 'cleanroom-targets.json'), 'utf8'));
  const targets = spec.targets.filter((t) => !args.only || args.only.has(t.id));
  if (targets.length === 0) {
    throw new Error(`--only matched no targets (known: ${spec.targets.map((t) => t.id).join(', ')})`);
  }

  const revision = (run('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT }).stdout || '').trim()
    || process.env.GITHUB_SHA || 'unknown';
  const startedAt = new Date().toISOString();

  process.stdout.write(`registry clean-room acceptance — ${targets.length} target(s), repo revision ${revision.slice(0, 12)}\n`);
  process.stdout.write('installing ONLY from public registries; no checkout on any module path\n\n');

  const results = [];
  for (const t of targets) {
    process.stdout.write(`-- ${t.id} (${t.ecosystem}: ${t.package})\n`);
    let r;
    try {
      r = t.ecosystem === 'npm' ? await runNpmTarget(t, args) : await runPypiTarget(t, args);
    } catch (e) {
      r = {
        id: t.id, ecosystem: t.ecosystem, package: t.package, version: 'unresolved',
        checks: [bad('resolve', `${e?.name}: ${String(e?.message).slice(0, 300)}`)],
      };
    }
    for (const c of r.checks) process.stdout.write(`   ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}: ${c.detail}\n`);
    process.stdout.write('\n');
    results.push(r);
  }

  const { evidence, fingerprint, verifiedAt } = buildEvidence(spec, results, revision);
  mkdirSync(args.outDir, { recursive: true });
  writeFileSync(join(args.outDir, 'cleanroom-report.json'), `${JSON.stringify({
    schema: 'wave-registry-cleanroom/1',
    spec_version: spec.spec_version || '1.0.0',
    repository: spec.repository || 'wave-av/sdks',
    revision,
    started_at: startedAt,
    finished_at: verifiedAt,
    evidence_sha256: fingerprint,
    runner: { node: process.version, platform: process.platform, python: args.python },
    version_pins: args.versions,
    targets: results,
  }, null, 2)}\n`);
  writeFileSync(join(args.outDir, 'ga-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);

  process.stdout.write(`${'-'.repeat(78)}\n`);
  for (const row of evidence.results) {
    process.stdout.write(`${row.criterion_id}: ${row.status.toUpperCase()} (${row.targets_observed.length} artifacts observed)\n`);
  }
  process.stdout.write(`\nevidence fingerprint: ${fingerprint}\n`);
  process.stdout.write(`wrote ${join(args.outDir, 'cleanroom-report.json')} and ${join(args.outDir, 'ga-evidence.json')}\n`);

  const failures = results.flatMap((r) => r.checks.filter((c) => !c.ok).map((c) => `${r.package}@${r.version} ${c.name}`));
  if (failures.length > 0) {
    process.stdout.write(`\nREGISTRY CLEAN-ROOM FAILED: ${failures.length} check(s)\n`);
    for (const f of failures) process.stdout.write(`  - ${f}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write('\nregistry clean-room: all checks passed\n');
}

main().catch((e) => {
  process.stderr.write(`registry-cleanroom could not run: ${e?.stack || e}\n`);
  process.exit(2); // distinct from 1 so CI can tell "gate failed" from "gate never ran"
});
