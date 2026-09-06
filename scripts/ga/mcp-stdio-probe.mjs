#!/usr/bin/env node
// Minimal MCP stdio client — initialize -> notifications/initialized -> tools/list.
//
// Deliberately speaks raw JSON-RPC over stdio instead of importing @modelcontextprotocol/sdk:
// the probe must be able to contradict the artifact under test, so it shares no code with it.
// Prints a single JSON object on stdout and exits 0; on failure prints {"ok":false,...} and
// exits 1. The caller (registry-cleanroom.mjs) parses that object.
//
// Usage: node mcp-stdio-probe.mjs <path-to-server-entrypoint>

import { spawn } from 'node:child_process';

const RPC_TIMEOUT_MS = Number(process.env.MCP_PROBE_TIMEOUT_MS || 30000);
const entry = process.argv[2];

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

if (!entry) {
  emit({ ok: false, error: 'usage: mcp-stdio-probe.mjs <server-entrypoint>' });
  process.exit(1);
}

const child = spawn(process.execPath, [entry], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    // A syntactically plausible but non-functional key. tools/list must not require a live
    // credential — if it does, that is itself a defect worth failing on. No real secret is
    // used and no authenticated request is expected to succeed.
    WAVE_API_KEY: process.env.WAVE_CLEANROOM_API_KEY || 'wave_cleanroom_not_a_real_key',
  },
});

let stdoutBuf = '';
let stderrBuf = '';
const pending = new Map();

child.stderr.on('data', (d) => {
  stderrBuf += d.toString();
  if (stderrBuf.length > 8000) stderrBuf = stderrBuf.slice(-8000);
});

child.stdout.on('data', (d) => {
  stdoutBuf += d.toString();
  let idx;
  while ((idx = stdoutBuf.indexOf('\n')) >= 0) {
    const line = stdoutBuf.slice(0, idx).trim();
    stdoutBuf = stdoutBuf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue; // servers sometimes log non-JSON to stdout; ignore rather than crash
    }
    const resolve = msg && msg.id != null ? pending.get(msg.id) : undefined;
    if (resolve) {
      pending.delete(msg.id);
      resolve(msg);
    }
  }
});

let childExit = null;
child.on('exit', (code, signal) => {
  childExit = { code, signal };
  for (const [, resolve] of pending) resolve({ error: { message: `server exited (code=${code} signal=${signal})` } });
  pending.clear();
});

let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout after ${RPC_TIMEOUT_MS}ms waiting for ${method}`));
    }, RPC_TIMEOUT_MS);
    pending.set(id, (m) => {
      clearTimeout(timer);
      resolve(m);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

function fail(message) {
  emit({ ok: false, error: message, stderr: stderrBuf.slice(0, 2000), exit: childExit });
  try { child.kill('SIGKILL'); } catch { /* already gone */ }
  process.exit(1);
}

try {
  const init = await rpc('initialize', {
    protocolVersion: process.env.MCP_PROTOCOL_VERSION || '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'wave-ga-cleanroom', version: '1.0.0' },
  });
  if (init.error) fail('initialize failed: ' + JSON.stringify(init.error).slice(0, 300));

  notify('notifications/initialized', {});

  const list = await rpc('tools/list', {});
  if (list.error) fail('tools/list failed: ' + JSON.stringify(list.error).slice(0, 300));

  const tools = (list.result && list.result.tools) || [];
  emit({
    ok: true,
    serverInfo: (init.result && init.result.serverInfo) || null,
    protocolVersion: (init.result && init.result.protocolVersion) || null,
    toolCount: tools.length,
    toolNames: tools.map((t) => t.name).sort(),
  });
  try { child.kill('SIGKILL'); } catch { /* already gone */ }
  process.exit(0);
} catch (err) {
  fail(String((err && err.message) || err));
}
