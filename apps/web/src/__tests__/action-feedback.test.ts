import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// Mock sonner toast
const toastMock = { success: vi.fn(), error: vi.fn() };
vi.mock('sonner', () => ({ toast: toastMock }));

// Mock fetch at the global level
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

// Mock crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });

describe('useSubmitAction feedback', () => {
  let queryClient: QueryClient;

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('shows success toast when action is queued', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ actionId: 'a1', status: 'queued' }),
    });

    const { useSubmitAction } = await import('@/hooks/use-submit-action');
    const { result } = renderHook(() => useSubmitAction(), { wrapper });

    act(() => {
      result.current.mutate({ type: 'WORK_SHIFT', payload: { jobFamily: 'manual', duration: 'short' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // No durationSeconds/scheduledFor in response → instant completion toast
    expect(toastMock.success).toHaveBeenCalledWith('Work shift completed');
  });

  it('shows error toast on API error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Insufficient vigor', code: 'INSUFFICIENT_VIGOR' }),
    });

    const { useSubmitAction } = await import('@/hooks/use-submit-action');
    const { result } = renderHook(() => useSubmitAction(), { wrapper });

    act(() => {
      result.current.mutate({ type: 'LEISURE' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toastMock.error).toHaveBeenCalledWith('Leisure failed: Insufficient vigor');
  });

  it('shows network error toast on fetch failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const { useSubmitAction } = await import('@/hooks/use-submit-action');
    const { result } = renderHook(() => useSubmitAction(), { wrapper });

    act(() => {
      result.current.mutate({ type: 'EAT_MEAL', payload: { quality: 'STREET_FOOD' } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringContaining('Network error'),
    );
  });

  it('shows server error toast on 500', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }),
    });

    const { useSubmitAction } = await import('@/hooks/use-submit-action');
    const { result } = renderHook(() => useSubmitAction(), { wrapper });

    act(() => {
      result.current.mutate({ type: 'SOCIAL_CALL' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringContaining('Server error (500)'),
    );
  });
});
