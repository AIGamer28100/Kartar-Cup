// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createPipController, getDocumentPip, type DocumentPipApi } from './usePictureInPicture';

const fakeWin = () => {
  const handlers: Record<string, () => void> = {};
  const win = {
    document: {},
    close: vi.fn(),
    addEventListener: (n: string, h: () => void) => (handlers[n] = h),
    removeEventListener: vi.fn(),
  };
  return { win: win as unknown as Window, handlers };
};

describe('getDocumentPip', () => {
  it('is null without the API and the API when present', () => {
    expect(getDocumentPip({})).toBeNull();
    const api = { requestWindow: async () => ({}) as Window };
    expect(getDocumentPip({ documentPictureInPicture: api })).toBe(api);
  });
});

describe('createPipController', () => {
  it('reports unsupported without an API', async () => {
    const c = createPipController(null, null);
    expect(c.supported).toBe(false);
    expect(await c.open({ width: 1, height: 1 })).toBe(false);
    expect(c.getSnapshot().error).toMatch(/not available/);
  });

  it('surfaces a rejected requestWindow and clears opening', async () => {
    const api: DocumentPipApi = { requestWindow: () => Promise.reject(new Error('needs user activation')) };
    const c = createPipController(api, {} as Document);
    expect(await c.open({ width: 1, height: 1 })).toBe(false);
    expect(c.getSnapshot()).toMatchObject({ opening: false, win: null });
    expect(c.getSnapshot().error).toContain('needs user activation');
  });

  it('closes the window and resets on close()', async () => {
    const { win } = fakeWin();
    const api: DocumentPipApi = { requestWindow: async () => win };
    const source = { head: { querySelectorAll: () => [] } } as unknown as Document;
    const target = {
      head: { appendChild: vi.fn() },
      documentElement: { style: {} },
      body: { style: {}, appendChild: vi.fn() },
      createElement: () => ({ style: {}, setAttribute: vi.fn() }),
    };
    (win as unknown as { document: unknown }).document = target;
    const c = createPipController(api, source);
    expect(await c.open({ width: 360, height: 220 })).toBe(true);
    expect(c.getSnapshot().win).toBe(win);
    expect(await c.open({ width: 1, height: 1 })).toBe(true);
    c.close();
    expect(win.close).toHaveBeenCalled();
    expect(c.getSnapshot()).toMatchObject({ win: null, container: null });
  });
});
