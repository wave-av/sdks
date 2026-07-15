import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared Kernel client so the adapter's lifecycle (create → playwright
// execute → deleteByID) is observable without a live Kernel API key.
const create = vi.fn();
const execute = vi.fn();
const deleteByID = vi.fn().mockResolvedValue(undefined);

vi.mock('@wave-av/kernel', async () => {
  const actual = await vi.importActual<typeof import('@wave-av/kernel')>('@wave-av/kernel');
  return {
    ...actual,
    WaveKernel: class {
      browsers = {
        create,
        deleteByID,
        playwright: { execute },
      };
    },
  };
});

async function tools() {
  const { createKernelTools } = await import('../adapters/kernel');
  return createKernelTools({ apiKey: 'test-key' });
}

function tool(name: string) {
  return tools().then((ts) => ts.find((t) => t.name === name)!);
}

/** The `code` string of the nth (0-indexed) `playwright.execute` call. */
function executedCode(nth: number): string {
  return (execute.mock.calls[nth][1] as { code: string }).code;
}

beforeEach(() => {
  create.mockReset().mockResolvedValue({ session_id: 'br_123', cdp_ws_url: 'ws://x' });
  execute.mockReset();
  deleteByID.mockReset().mockResolvedValue(undefined);
});

describe('Kernel adapter — lifecycle', () => {
  it('browse_url creates a session, runs goto/title/content code, then tears it down', async () => {
    execute.mockResolvedValue({ success: true, result: { title: 'T', content: '<html>' } });
    const browse = await tool('browse_url');

    const out = await browse.handler({ url: 'https://example.com' });

    expect(create).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith('br_123', { code: expect.stringContaining('page.goto') });
    expect(executedCode(0)).toContain('page.title');
    expect(deleteByID).toHaveBeenCalledWith('br_123');
    expect(out).toEqual({ title: 'T', content: '<html>' });
  });

  it('waitForSelector is injected into the executed code when provided', async () => {
    execute.mockResolvedValue({ success: true, result: {} });
    const browse = await tool('browse_url');

    await browse.handler({ url: 'https://example.com', waitForSelector: '#player' });

    expect(executedCode(0)).toContain('waitForSelector');
    expect(executedCode(0)).toContain('#player');
  });

  it('take_screenshot returns base64 and uses fullPage when no selector', async () => {
    execute.mockResolvedValue({ success: true, result: { screenshotBase64: 'AAAA', width: 800, height: 600 } });
    const shot = await tool('take_screenshot');

    const out = await shot.handler({ url: 'https://example.com', width: 800, height: 600 });

    expect(executedCode(0)).toContain('fullPage: true');
    expect(out).toEqual({ screenshotBase64: 'AAAA', width: 800, height: 600 });
  });

  it('take_screenshot scopes to a locator (no fullPage) when a selector is given', async () => {
    execute.mockResolvedValue({ success: true, result: {} });
    const shot = await tool('take_screenshot');

    await shot.handler({ url: 'https://example.com', selector: '.video' });

    const code = executedCode(0);
    expect(code).toContain('page.locator');
    expect(code).not.toContain('fullPage');
  });

  it('run_playwright navigates first when a url is given, then runs the user code', async () => {
    execute.mockResolvedValue({ success: true, result: 'done' });
    const run = await tool('run_playwright');

    const out = await run.handler({ code: 'return await page.title();', url: 'https://example.com' });

    expect(executedCode(0)).toContain('page.goto');
    expect(execute).toHaveBeenNthCalledWith(2, 'br_123', { code: 'return await page.title();' });
    expect(out).toEqual({ output: 'done', logs: [] });
  });

  it('a non-success execution surfaces a KernelApiError AND still tears the session down', async () => {
    const { KernelApiError } = await import('@wave-av/kernel');
    execute.mockResolvedValue({ success: false, error: 'boom' });
    const browse = await tool('browse_url');

    await expect(browse.handler({ url: 'https://example.com' })).rejects.toBeInstanceOf(KernelApiError);
    expect(deleteByID).toHaveBeenCalledWith('br_123');
  });
});
