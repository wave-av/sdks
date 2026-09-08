// SBOM-presence check (SUPPLY-001 GA criterion, cw#4803) — ecosystem-agnostic.
//
// WHY THIS IS A SEPARATE MODULE, NOT A CLEAN-ROOM INSTALL CHECK
// This repo's registry-cleanroom checks answer "does the published REGISTRY artifact work" by
// installing it. SBOM attachment is a different question: "does the GITHUB RELEASE that backs
// this artifact carry an SBOM asset (*.spdx.json / *.cdx.json)". This check verifies PRESENCE of
// such a file by name only — it does NOT verify the SBOM's contents, signature, or that it
// actually describes the released artifact; "SBOM asset present" is the GA-READINESS.md-documented
// claim, deliberately never overstated to "signed" or "validated". That question needs no install
// — it needs the repository the package itself declares (npm `repository.url`, PyPI
// `project_urls.Repository`) and a read of that repo's GitHub Releases API. It is called directly
// from BOTH ecosystem runners in cleanroom-targets.mjs (runNpmTarget, runPypiTarget), before
// either one's install step — not through cleanroom-checks.mjs's CHECKS table (npm) or
// cleanroom_python_assert.py (PyPI), because both of those assume a successful install and this
// check must still produce evidence when install fails.
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

const GITHUB_API_TIMEOUT_MS = 30_000;

/** True for a GitHub API response that is a RATE LIMIT, not a real "repo/release doesn't exist" —
 * distinguished so a reader of GA-READINESS.md evidence can tell "genuinely no SBOM" apart from
 * "GitHub throttled the check" at a glance, rather than both surfacing as the same generic error. */
function isRateLimited(res) {
  if (res.status !== 403 && res.status !== 429) return false;
  const remaining = res.headers?.get?.('x-ratelimit-remaining');
  return res.status === 429 || remaining === '0';
}

/** Fetch `GET /repos/{owner}/{repo}/releases/latest`. `fetchImpl` is injectable so tests never
 * hit the network (this repo's convention — see cleanroom-pypi-yank.test.mjs). Bounded by a 30s
 * deadline (`AbortSignal`) covering both the request and the `res.json()` body read, so a stalled
 * GitHub response cannot hang the whole clean-room run — an aborted or errored request must still
 * surface as a `bad` check result, never as a suite that silently never finishes. */
export async function fetchLatestRelease(repo, fetchImpl = fetch) {
  const [owner, name] = repo.split('/');
  const headers = { 'user-agent': 'wave-ga-registry-cleanroom/1.0', accept: 'application/vnd.github+json' };
  // Read from `GITHUB_TOKEN`/`GH_TOKEN` when present (wired in by `registry-cleanroom.yml`'s
  // `GITHUB_TOKEN: ${{ github.token }}`) so this runs authenticated (5,000 req/hour) rather than
  // sharing the unauthenticated 60 req/hour limit across GitHub Actions' shared runner IP pool —
  // 5 targets on every `pull_request` + nightly + post-publish trigger would otherwise risk
  // exhausting that limit and turning a rate-limit response into a fabricated "no SBOM" reading.
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/releases/latest`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_API_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { headers, signal: controller.signal });
    if (res.status === 404) return { notFound: true };
    if (isRateLimited(res)) return { rateLimited: true, status: res.status };
    if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ecosystem-agnostic SBOM presence check. `packageLabel` is `name@version`, for messages only.
 * `repoRaw` is whatever the ecosystem's own metadata declares as its repository (npm
 * `packument.repository`, PyPI `versionMeta.info.project_urls.Repository` — the RESOLVED
 * version's own metadata, not the project-level document, so a `--versions`-pinned older release
 * is checked against the repository IT declared, not whatever the project's newest release moved
 * to since).
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
  if (release?.rateLimited) {
    return bad('sbom-presence', `RATE LIMITED (HTTP ${release.status}) querying ${repo}'s latest GitHub Release for ${packageLabel} — this is GitHub throttling the check, NOT an observation that the SBOM is missing; re-run with a GITHUB_TOKEN/GH_TOKEN set, or retry once the rate limit resets`);
  }
  const assets = (release.assets || []).map((a) => a.name);
  const sbomAssets = assets.filter((n) => SBOM_ASSET_RE.test(n));
  return sbomAssets.length > 0
    ? ok('sbom-presence', `${repo}@${release.tag_name} carries SBOM asset(s): ${sbomAssets.join(', ')}`)
    : bad('sbom-presence',
      `${repo}@${release.tag_name} (latest release backing ${packageLabel}) carries NO SBOM asset ` +
      `(*.spdx.json/*.cdx.json) among: ${assets.length ? assets.join(', ') : '(no assets)'}`);
}
