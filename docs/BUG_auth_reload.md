# BUG: Auth Reload Loop on Login/Register Pages

**Status:** Fixed
**Branch:** `fix/auth-reload-loop`
**Severity:** Ship-blocking — login and registration pages are unusable

## Symptoms

- Visiting `/login` causes the page to reload in an infinite loop
- Visiting `/register` immediately redirects to `/login` (also looping)
- Browser network tab shows repeated `GET /api/me/state` calls returning 401
- Browser console shows no errors (hard reload clears console each time)

## Root Cause

The reload loop is caused by a chain of 3 interacting components:

### 1. Global 401 handler in `api.ts` (PRIMARY CAUSE)

```ts
// apps/web/src/lib/api.ts:39-43
if (res.status === 401) {
  if (typeof window !== 'undefined' && !API_BASE) {
    window.location.href = '/login';  // <-- Hard page reload
  }
  throw new ApiError(401, 'UNAUTHORIZED', 'Session expired');
}
```

This handler runs on **every** 401 response, regardless of what page the user is on.
It performs a **hard navigation** (`window.location.href`), which fully reloads the
page and resets all React state.

### 2. AuthProvider runs on every page including public routes

`AuthProvider` wraps the root layout (`app/layout.tsx` → `<Providers>`), so it renders
on `/login` and `/register` too. On mount it fires:

```ts
useQuery({
  queryKey: ['player', 'state'],
  queryFn: () => api.get('/me/state'),
  retry: false,
  refetchInterval: 60_000,
  staleTime: 30_000,
});
```

When an unauthenticated user visits `/login`, this query fires, gets 401, and the global
handler does `window.location.href = '/login'` — reloading the very page they're on.

### 3. Aggressive React Query defaults

```ts
// providers.tsx
new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,                   // retries 401s (wasteful)
      refetchOnWindowFocus: true,  // tab focus triggers query → 401 → reload
    },
  },
})
```

`refetchOnWindowFocus: true` means every time the user focuses the browser tab,
all queries refetch. The auth query gets a 401 → hard redirect → loop.

### The complete cycle

```
User visits /login
  → AuthProvider mounts
  → useQuery fires GET /me/state
  → Server returns 401 (no session)
  → api.ts 401 handler: window.location.href = '/login'
  → Full page reload to /login
  → AuthProvider mounts again
  → ... infinite loop
```

### Why registration is broken

Same mechanism: user visits `/register`, AuthProvider query fires, 401 response,
`api.ts` redirects to `/login`. The user never stays on `/register` long enough to
fill out the form.

## Fix Applied

### A. Remove hard redirect from api.ts 401 handler

The API client now throws the `ApiError` on 401 without performing any navigation.
Auth state management and navigation are handled by the auth layer, not the HTTP client.

### B. React Query safe defaults

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Never retry auth errors
        if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})
```

### C. Auth architecture separation

- **AuthProvider** now manages auth STATE only (token, user data, login/register/logout
  functions). It does NOT perform any navigation.
- **`<RequireAuth />`** is a new guard component used only on protected routes (game layout).
  It redirects to `/login` only when auth state is definitively "unauthenticated" (not loading).
- Public routes (`/login`, `/register`, `/`) are never wrapped in `<RequireAuth />`.

### D. Loop breaker safeguard

A client-side circuit breaker tracks auth state transitions. If auth flips between
authenticated/unauthenticated more than 3 times in 5 seconds, it stops all auto-navigation
and shows an error with a "Reset session" button. This prevents any future infinite
loops from becoming unusable.

## Prevention

- Unit tests verify AuthProvider does not call `window.location` or hard navigation
- E2E tests verify `/login` URL stability (no reload loop)
- E2E tests verify registration flow completes successfully
- E2E tests verify `/me/state` is not hammered (max 5 calls in 3 seconds)
