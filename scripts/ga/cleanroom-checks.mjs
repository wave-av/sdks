// The acceptance checks themselves. Each takes a per-target context and returns one result.
//
// Design rule: a check reports the artifact's OWN words back (its version strings, its tool list,
// its resolved module paths) rather than asserting a value hardcoded here. A suite that encodes
// the expected answer drifts into agreeing with itself; a suite that quotes the artifact can only
// pass when the artifact is actually coherent.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bad, installedManifest, ok, run } from './cleanroom-util.mjs';

const DEFAULT_ADVERTISED_TOOL_PATTERN = '(?:wave|mvp)_[a-z0-9_]+';

export const CHECKS = {
  'npm-provenance-attested': async (ctx) => {
    const att = ctx.packument?.dist?.attestations;
    if (att?.provenance?.predicateType) {
      return ok('npm-provenance-attested', `provenance attestation present (${att.provenance.predicateType})`);
    }
    return bad('npm-provenance-attested',
      `${ctx.pkg}@${ctx.version} has NO provenance attestation on npm (dist.attestations=${JSON.stringify(att ?? null)}). ` +
      'The published artifact cannot be traced to an approved CI build of an immutable source revision.');
  },

  'esm-import': async (ctx) => {
    const f = join(ctx.room, 'probe-esm.mjs');
    writeFileSync(f, `import * as m from ${JSON.stringify(ctx.pkg)};\nconsole.log(Object.keys(m).length);\n`);
    const r = run(process.execPath, [f], { cwd: ctx.room, env: ctx.env, timeout: 120000 });
    return r.status === 0
      ? ok('esm-import', `static ESM \`import * from '${ctx.pkg}'\` OK (${r.stdout.trim()} named exports)`)
      : bad('esm-import', `static ESM import failed: ${(r.stderr || r.stdout).trim().slice(0, 400)}`);
  },

  'cjs-require': async (ctx) => {
    const f = join(ctx.room, 'probe-cjs.cjs');
    writeFileSync(f, `const m = require(${JSON.stringify(ctx.pkg)});\nconsole.log(Object.keys(m).length);\n`);
    const r = run(process.execPath, [f], { cwd: ctx.room, env: ctx.env, timeout: 120000 });
    return r.status === 0
      ? ok('cjs-require', `\`require('${ctx.pkg}')\` OK (${r.stdout.trim()} keys)`)
      : bad('cjs-require', `CJS require failed: ${(r.stderr || r.stdout).trim().slice(0, 400)}`);
  },

  'subpath-exports': async (ctx) => {
    const exportsMap = ctx.manifest?.exports;
    if (!exportsMap || typeof exportsMap !== 'object') {
      return bad('subpath-exports', `${ctx.pkg}@${ctx.version} declares no "exports" map — subpath resolution is unverifiable`);
    }
    const subpaths = Object.keys(exportsMap).filter((k) => k !== './package.json');
    const f = join(ctx.room, 'probe-subpaths.mjs');
    writeFileSync(f, [
      `const subpaths = ${JSON.stringify(subpaths)};`,
      `const pkg = ${JSON.stringify(ctx.pkg)};`,
      'const failed = [];',
      'for (const sp of subpaths) {',
      "  const spec = sp === '.' ? pkg : pkg + '/' + sp.replace(/^\\.\\//, '');",
      "  try { await import(spec); } catch (e) { failed.push(spec + ': ' + (e.code || e.name)); }",
      '}',
      'console.log(JSON.stringify({ total: subpaths.length, failed }));',
    ].join('\n'));
    const r = run(process.execPath, [f], { cwd: ctx.room, env: ctx.env, timeout: 180000 });
    if (r.status !== 0) return bad('subpath-exports', `subpath probe crashed: ${(r.stderr || r.stdout).trim().slice(0, 400)}`);
    let parsed;
    try { parsed = JSON.parse(r.stdout.trim().split('\n').pop()); }
    catch { return bad('subpath-exports', `unparseable probe output: ${r.stdout.slice(0, 200)}`); }
    return parsed.failed.length === 0
      ? ok('subpath-exports', `all ${parsed.total} declared subpath exports resolve`)
      : bad('subpath-exports', `${parsed.failed.length}/${parsed.total} declared subpath exports fail to resolve: ${parsed.failed.slice(0, 8).join('; ')}`);
  },

  'bin-help-exit-zero': async (ctx) => {
    const bin = ctx.binPath();
    if (!bin) return bad('bin-help-exit-zero', `no bin found for ${ctx.pkg} (declared bin: ${JSON.stringify(ctx.manifest?.bin ?? null)})`);
    const r = run(process.execPath, [bin, '--help'], { cwd: ctx.room, env: ctx.env, timeout: 120000 });
    return r.status === 0
      ? ok('bin-help-exit-zero', `\`${ctx.target.bin} --help\` exited 0 (${r.stdout.split('\n').length} lines)`)
      : bad('bin-help-exit-zero', `\`${ctx.target.bin} --help\` exited ${r.status}: ${(r.stderr || r.stdout).trim().slice(0, 400)}`);
  },

  'bin-version-matches-package': async (ctx) => {
    const bin = ctx.binPath();
    if (!bin) return bad('bin-version-matches-package', `no bin found for ${ctx.pkg}`);
    const r = run(process.execPath, [bin, '--version'], { cwd: ctx.room, env: ctx.env, timeout: 120000 });
    if (r.status !== 0) return bad('bin-version-matches-package', `\`${ctx.target.bin} --version\` exited ${r.status}: ${(r.stderr || r.stdout).trim().slice(0, 300)}`);
    const printed = (r.stdout.trim().match(/\d+\.\d+\.\d+[^\s]*/) || [r.stdout.trim()])[0];
    return printed === ctx.manifest.version
      ? ok('bin-version-matches-package', `\`${ctx.target.bin} --version\` prints ${printed}, matching the installed package version`)
      : bad('bin-version-matches-package',
        `VERSION LIE: npm served ${ctx.pkg}@${ctx.manifest.version} but \`${ctx.target.bin} --version\` prints ${printed}. ` +
        'A user cannot tell which build they are running, and a bug report cannot be tied to a revision.');
  },

  'bin-help-banner-version-consistent': async (ctx) => {
    const bin = ctx.binPath();
    if (!bin) return bad('bin-help-banner-version-consistent', `no bin found for ${ctx.pkg}`);
    const r = run(process.execPath, [bin, '--help'], { cwd: ctx.room, env: ctx.env, timeout: 120000 });
    // Only lines that actually advertise a version count. A bare semver elsewhere in help text
    // (an example payload, a protocol number) must not manufacture a false failure.
    const claimed = new Set();
    for (const line of `${r.stdout}\n${r.stderr}`.split('\n')) {
      if (!/version|\bv\d/i.test(line)) continue;
      for (const m of line.matchAll(/\bv?(\d+\.\d+\.\d+)\b/g)) claimed.add(m[1]);
    }
    if (claimed.size === 0) return ok('bin-help-banner-version-consistent', 'help output advertises no version string (nothing to contradict)');
    const wrong = [...claimed].filter((v) => v !== ctx.manifest.version);
    return wrong.length === 0
      ? ok('bin-help-banner-version-consistent', `help banner advertises ${[...claimed].join(', ')}, matching the installed version`)
      : bad('bin-help-banner-version-consistent', `help banner advertises version(s) ${wrong.join(', ')} but npm served ${ctx.manifest.version}`);
  },

  'declared-dep-ranges-pinned': async (ctx) => {
    // A floating range on a first-party sibling put a broken SDK inside a "known good" CLI with
    // no commit anywhere. A published artifact whose own dependencies can move is not reproducible,
    // which is why this must be checked nightly and not only at release.
    const firstParty = Object.entries(ctx.manifest?.dependencies || {}).filter(([n]) => n.startsWith('@wave-av/'));
    if (firstParty.length === 0) return ok('declared-dep-ranges-pinned', 'no first-party runtime dependencies to pin');
    const resolved = firstParty.map(([n]) => `${n}@${installedManifest(ctx.room, n)?.version ?? '<not installed>'}`);
    const floating = firstParty.filter(([, range]) => !/^\d+\.\d+\.\d+/.test(range));
    return floating.length === 0
      ? ok('declared-dep-ranges-pinned', `first-party deps exact-pinned; resolved to ${resolved.join(', ')}`)
      : bad('declared-dep-ranges-pinned',
        `${ctx.pkg}@${ctx.manifest.version} declares floating first-party range(s) ` +
        `${floating.map(([n, r]) => `${n}: "${r}"`).join(', ')} — today they resolve to ${resolved.join(', ')}, ` +
        'but tomorrow the same published artifact can ship a different sibling with no commit anywhere.');
  },

  'mcp-server-lists-tools': async (ctx) => {
    const probe = await ctx.mcpProbe();
    if (!probe.ok) return bad('mcp-server-lists-tools', `server did not complete initialize + tools/list: ${probe.error}`);
    return probe.toolCount > 0
      ? ok('mcp-server-lists-tools', `server started and listed ${probe.toolCount} tools: ${probe.toolNames.slice(0, 6).join(', ')}${probe.toolCount > 6 ? ', …' : ''}`)
      : bad('mcp-server-lists-tools', 'server started but advertises zero tools');
  },

  'mcp-serverinfo-version-matches-package': async (ctx) => {
    const probe = await ctx.mcpProbe();
    if (!probe.ok) return bad('mcp-serverinfo-version-matches-package', `could not reach serverInfo: ${probe.error}`);
    const reported = probe.serverInfo?.version ?? null;
    return reported === ctx.manifest.version
      ? ok('mcp-serverinfo-version-matches-package', `serverInfo.version ${reported} matches the installed package version`)
      : bad('mcp-serverinfo-version-matches-package',
        `VERSION LIE: npm served ${ctx.pkg}@${ctx.manifest.version} but the running server reports ` +
        `serverInfo.version=${JSON.stringify(reported)}. An MCP client cannot identify the build it connected to.`);
  },

  'mcp-advertised-tools-are-served': async (ctx) => {
    const readmePath = join(ctx.room, 'node_modules', ...ctx.pkg.split('/'), 'README.md');
    if (!existsSync(readmePath)) {
      return bad('mcp-advertised-tools-are-served', `${ctx.pkg}@${ctx.version} ships no README.md — its advertised tool surface cannot be verified against what it serves`);
    }
    const probe = await ctx.mcpProbe();
    if (!probe.ok) return bad('mcp-advertised-tools-are-served', `could not list served tools: ${probe.error}`);
    // Only backticked identifiers count. Bare prose matching picks up things like the API-key
    // example `wave_live_...` and would fabricate a failure.
    const pattern = new RegExp('`(' + (ctx.target.advertised_tool_pattern || DEFAULT_ADVERTISED_TOOL_PATTERN) + ')`', 'g');
    const advertised = [...new Set([...readFileSync(readmePath, 'utf8').matchAll(pattern)].map((m) => m[1]))].sort();
    if (advertised.length === 0) return bad('mcp-advertised-tools-are-served', 'shipped README advertises no tool names — the artifact documents nothing it serves');
    const served = new Set(probe.toolNames);
    const missing = advertised.filter((t) => !served.has(t));
    if (missing.length > 0) {
      return bad('mcp-advertised-tools-are-served', `shipped README advertises ${missing.length} tool(s) the server does not serve: ${missing.join(', ')}`);
    }
    const undocumented = probe.toolNames.filter((t) => !advertised.includes(t));
    const extra = undocumented.length
      ? ` (${undocumented.length} served but undocumented: ${undocumented.slice(0, 5).join(', ')}${undocumented.length > 5 ? ', …' : ''})`
      : '';
    return ok('mcp-advertised-tools-are-served', `all ${advertised.length} README-advertised tools are served${extra}`);
  },
};
