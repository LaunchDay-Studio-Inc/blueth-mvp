import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC_DIR = resolve(__dirname, '..');

describe('api.ts 401 handler', () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    // @ts-expect-error -- intentionally replacing location for test
    delete window.location;
    window.location = { ...originalLocation, href: 'http://localhost:3000/login' } as Location;
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.restoreAllMocks();
  });

  it('does not hard-redirect on 401', async () => {
    // Mock fetch to return 401
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
    });

    const { api, ApiError } = await import('@/lib/api');

    const hrefSetter = vi.fn();
    Object.defineProperty(window.location, 'href', {
      get: () => 'http://localhost:3000/login',
      set: hrefSetter,
      configurable: true,
    });

    await expect(api.get('/me/state')).rejects.toThrow(ApiError);

    // The critical assertion: no hard navigation
    expect(hrefSetter).not.toHaveBeenCalled();
  });
});

describe('auth source code guards', () => {
  it('AuthProvider does not contain window.location.reload', () => {
    const source = readFileSync(resolve(SRC_DIR, 'lib/auth-context.tsx'), 'utf-8');

    expect(source).not.toContain('window.location.reload');
    expect(source).not.toContain('location.reload()');
  });

  it('api.ts does not hard-navigate on 401', () => {
    const source = readFileSync(resolve(SRC_DIR, 'lib/api.ts'), 'utf-8');

    // The 401 block should NOT contain window.location.href
    const authBlock = source.match(/if\s*\(res\.status\s*===\s*401\)\s*\{[^}]*\}/s);
    expect(authBlock).toBeTruthy();
    expect(authBlock![0]).not.toContain('window.location');
  });
});
