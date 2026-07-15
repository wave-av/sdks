/**
 * Kernel Adapter for WAVE ADK
 *
 * Provides cloud browser capabilities to WAVE agents via Kernel:
 * - Screenshot live stream players for visual QA
 * - Interact with third-party dashboards (Mux, Cloudflare)
 * - Run visual regression on embedded players
 * - Scrape competitor streaming pages for intelligence
 *
 * Kernel provides managed cloud browsers (unikernel-based) with a Playwright
 * execution surface, session persistence, and file I/O.
 *
 * All Kernel access goes through the shared {@link WaveKernel} client
 * (`@wave-av/kernel`), never a hand-rolled fetch — one place for telemetry,
 * resilience, auth, and the SDK's real resource surface
 * (law: kernel-substrate-governed).
 *
 * @see https://docs.onkernel.com
 */

import { WaveKernel, KernelApiError } from '@wave-av/kernel';
import { z } from 'zod';
import type { AgentTool } from '../tools/AgentToolkit.js';

export interface KernelConfig {
  readonly apiKey: string;
  /** Override the Kernel API base URL. Defaults to the SDK default (`https://api.onkernel.com/`). */
  readonly baseUrl?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

/**
 * Create WAVE ADK tools backed by Kernel cloud browsers.
 *
 * Each tool spins up a fresh Kernel browser session, drives it through the
 * SDK's Playwright execution surface, and always tears the session down.
 *
 * Usage:
 * ```typescript
 * import { createKernelTools } from '@wave-av/adk/adapters/kernel';
 * import { AgentToolkit } from '@wave-av/adk';
 *
 * const kernelTools = createKernelTools({ apiKey: process.env.KERNEL_API_KEY });
 * // Add to existing toolkit or use standalone
 * ```
 */
export function createKernelTools(config: KernelConfig): AgentTool[] {
  const kernel = new WaveKernel({
    apiKey: config.apiKey,
    ...(config.baseUrl !== undefined ? { baseURL: config.baseUrl } : {}),
  });

  /**
   * Create a fresh cloud browser, run `fn` against its session id, and always
   * terminate the session afterwards (even if `fn` throws). Teardown failures
   * are swallowed so they never mask the real result/error.
   */
  async function withBrowser<T>(fn: (browserId: string) => Promise<T>): Promise<T> {
    const browser = await kernel.browsers.create({});
    try {
      return await fn(browser.session_id);
    } finally {
      await kernel.browsers.deleteByID(browser.session_id).catch(() => {});
    }
  }

  /**
   * Execute Playwright code in the browser VM. The code has access to `page`,
   * `context`, and `browser`, and returns via `return`. A non-success result is
   * surfaced through the shared Kernel error taxonomy.
   */
  async function execute(browserId: string, code: string): Promise<unknown> {
    const res = await kernel.browsers.playwright.execute(browserId, { code });
    if (!res.success) {
      throw new KernelApiError(res.error ?? 'Playwright execution failed', undefined, {
        browserId,
      });
    }
    return res.result;
  }

  const browseSchema = z.object({
    url: z.string().url(),
    waitForSelector: z.string().optional(),
    timeoutMs: z.number().optional(),
  });
  const screenshotSchema = z.object({
    url: z.string().url(),
    selector: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  });
  const playwrightSchema = z.object({ code: z.string().min(1), url: z.string().url().optional() });

  return [
    {
      name: 'browse_url',
      description:
        'Navigate a cloud browser to a URL and return the page title + HTML content. Uses Kernel managed browsers — no local browser needed.',
      parameters: {
        url: { type: 'string', description: 'URL to navigate to', required: true },
        waitForSelector: {
          type: 'string',
          description: 'CSS selector to wait for before capturing',
          required: false,
        },
        timeoutMs: {
          type: 'number',
          description: 'Navigation timeout in milliseconds',
          required: false,
        },
      },
      schema: browseSchema,
      handler: async (params: Record<string, unknown>) =>
        withBrowser(async (id) => {
          const timeout = Number(params.timeoutMs ?? DEFAULT_TIMEOUT_MS);
          const waitForSelector = params.waitForSelector
            ? `await page.waitForSelector(${JSON.stringify(params.waitForSelector)}, { timeout: ${timeout} });`
            : '';
          const code = [
            `await page.goto(${JSON.stringify(params.url)}, { waitUntil: 'load', timeout: ${timeout} });`,
            waitForSelector,
            `return { title: await page.title(), content: await page.content() };`,
          ]
            .filter(Boolean)
            .join('\n');
          return (await execute(id, code)) as { title: string; content: string };
        }),
    },
    {
      name: 'take_screenshot',
      description:
        'Take a screenshot of a URL using a cloud browser. Returns a base64-encoded PNG. Useful for visual QA of live stream players.',
      parameters: {
        url: { type: 'string', description: 'URL to screenshot', required: true },
        selector: {
          type: 'string',
          description: 'CSS selector to screenshot (optional, defaults to full page)',
          required: false,
        },
        width: { type: 'number', description: 'Viewport width in pixels', required: false },
        height: { type: 'number', description: 'Viewport height in pixels', required: false },
      },
      schema: screenshotSchema,
      handler: async (params: Record<string, unknown>) =>
        withBrowser(async (id) => {
          const width = Number(params.width ?? DEFAULT_WIDTH);
          const height = Number(params.height ?? DEFAULT_HEIGHT);
          // Element screenshots can't use fullPage; full-page shots can.
          const target = params.selector
            ? `page.locator(${JSON.stringify(params.selector)})`
            : 'page';
          const shotOpts = params.selector ? `{ type: 'png' }` : `{ type: 'png', fullPage: true }`;
          const code = [
            `await page.setViewportSize({ width: ${width}, height: ${height} });`,
            `await page.goto(${JSON.stringify(params.url)}, { waitUntil: 'load', timeout: ${DEFAULT_TIMEOUT_MS} });`,
            `const buf = await ${target}.screenshot(${shotOpts});`,
            `return { screenshotBase64: buf.toString('base64'), width: ${width}, height: ${height} };`,
          ].join('\n');
          return (await execute(id, code)) as {
            screenshotBase64: string;
            width: number;
            height: number;
          };
        }),
    },
    {
      name: 'run_playwright',
      description:
        'Execute Playwright code in a Kernel cloud browser. For complex browser automation like testing embed players or monitoring dashboards.',
      parameters: {
        code: { type: 'string', description: 'Playwright JavaScript code to execute', required: true },
        url: { type: 'string', description: 'Starting URL (optional)', required: false },
      },
      schema: playwrightSchema,
      handler: async (params: Record<string, unknown>) =>
        withBrowser(async (id) => {
          if (params.url) {
            await execute(
              id,
              `await page.goto(${JSON.stringify(params.url)}, { waitUntil: 'load', timeout: ${DEFAULT_TIMEOUT_MS} });`,
            );
          }
          const result = await execute(id, String(params.code));
          return { output: result ?? '', logs: [] as string[] };
        }),
    },
  ];
}
