// SBOM-presence check (SUPPLY-001 GA criterion, cw#4803) — ecosystem-agnostic.
//
// WHY THIS IS A SEPARATE MODULE, NOT A CLEAN-ROOM INSTALL CHECK
// This repo's registry-cleanroom checks answer "does the published REGISTRY artifact work" by
// installing it. SBOM attachment is a different question: "does the GITHUB RELEASE that backs
// this artifact carry a signed bill of materials". That question needs no install — it needs the
// repository the package itself declares (npm `repository.url`, PyPI `project_urls.Repository`)
// and a read of that repo's GitHub Releases API. It runs from both the npm path
// (cleanroom-checks.mjs, via the existing CHECKS table) and the PyPI path (cleanroom-targets.mjs,
// called directly — PyPI checks otherwise come from cleanroom_python_assert.py, a Python
// subprocess that has no business calling GitHub's API).
//
// DESIGN RULE, same one the rest of this suite follows: report the artifact's OWN declared
// repository back, never a hardcoded owner/repo map that can drift the day a package moves (this
// repo lived through exactly that: @wave-av/sdk and wave-sdk moved to standalone repos under
// Option A, 2026-09-06, and their PACKAGE METADATA already reflects it).
//
// SSRF / injection posture: `repoFromMetadata` accepts ONLY a github.com host and validates
// owner/repo against GitHub's actual charset (alphanumerics, `-`, `_`, `.`) before returning
// anything — a value that doesn't match returns `null`, never a same-shaped-but-wrong string. The
// GitHub API host is a compile-time constant (`https://api.github.com`) that no input can steer;
// only the already-validated owner/repo path segments are interpolated, and each is additionally
// re-encoded with `encodeURIComponent` at the call site so no validated segment can smuggle a
// path separator into the request URL.

import { bad, ok } from './cleanroom-util.mjs';

const SBOM_ASSET_RE = /\.(spdx|cdx)\.json$/i;
const GITHUB_SLUG_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

/**
 * Extract "owner/repo" from an npm `repository` field (string or `{url}` object) or a PyPI
 * `project_urls.Repository` URL. Returns null when nothing GitHub-shaped and charset-valid is
 * declared — callers MUST treat null as "cannot verify", never as "no SBOM needed".
 */
export function repoFromMetadata(raw) {
  if (!raw) return null;
  const rawUrl = typeof raw === 'string' ? raw : raw.url;
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  // Normalize scp-like syntax (`git@github.com:owner/repo.git`, no `://`) to a URL the main regex
  // below understands — this is the one shape a package.json `repository.url` can carry that
  // isn't already a URL, e.g. a manually-authored (non-npm-normalized) field.
  const url = /^git@github\.com:/i.test(rawUrl.trim()) ? rawUrl.trim().replace(/^git@github\.com:/i, 'ssh://git@github.com/') : rawUrl;
  const m = /^(?:git\+)?(?:https?|git|ssh):\/\/(?:[^@/]+@)?github\.com[:/]+([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(url.trim());
  if (!m) return null;
  const [, owner, repo] = m;
  if (!GITHUB_SLUG_RE.test(owner) || !GITHUB_SLUG_RE.test(repo)) return null;
  return `${owner}/${repo}`;
}

/** Fetch `GET /repos/{owner}/{repo}/releases/latest`. `fetchImpl` is injectable so tests never
 * hit the network (this repo's convention — see cleanroom-pypi-yank.test.mjs). */
export async function fetchLatestRelease(repo, fetchImpl = fetch) {
  const [owner, name] = repo.split('/');
  const headers = { 'user-agent': 'wave-ga-registry-cleanroom/1.0', accept: 'application/vnd.github+json' };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/releases/latest`;
  const res = await fetchImpl(url, { headers });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.json();
}

/**
 * Ecosystem-agnostic SBOM presence check. `packageLabel` is `name@version`, for messages only.
 * `repoRaw` is whatever the ecosystem's own metadata declares as its repository (npm
 * `packument.repository`, PyPI `projectMeta.info.project_urls.Repository`).
 *
 * Never fabricates a pass: a lookup failure (unresolvable repo, network error, non-2xx/404
 * response) is reported as `bad`, exactly like "no SBOM asset found" — "could not check" and
 * "checked and it's missing" both fail the GA criterion; only a positively-observed SBOM asset
 * passes.
 */
export async function checkSbomPresence({ packageLabel, repoRaw, fetchImpl = fetch }) {
  const repo = repoFromMetadata(repoRaw);
  if (!repo) {
    return bad('sbom-presence', `${packageLabel} declares no GitHub repository in its published metadata — cannot locate a release to check for an SBOM asset`);
  }
  let release;
  try {
    release = await fetchLatestRelease(repo, fetchImpl);
  } catch (e) {
    return bad('sbom-presence', `could not query ${repo}'s latest GitHub Release: ${e?.message || e}`);
  }
  if (release?.notFound) {
    return bad('sbom-presence', `${repo} has no GitHub Release at all (checked releases/latest) — ${packageLabel} carries no SBOM`);
  }
  const assets = (release.assets || []).map((a) => a.name);
  const sbomAssets = assets.filter((n) => SBOM_ASSET_RE.test(n));
  return sbomAssets.length > 0
    ? ok('sbom-presence', `${repo}@${release.tag_name} carries SBOM asset(s): ${sbomAssets.join(', ')}`)
    : bad('sbom-presence',
      `${repo}@${release.tag_name} (latest release backing ${packageLabel}) carries NO SBOM asset ` +
      `(*.spdx.json/*.cdx.json) among: ${assets.length ? assets.join(', ') : '(no assets)'}`);
}
