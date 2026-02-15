# Interactivity Feedback Fix Report

## Problem

Most Go buttons (Jobs, Food, Leisure, Business) appeared to do nothing when clicked.
Users received zero visual feedback on success, making the app feel broken.

## Root Cause Analysis

### Buttons were NOT broken at the wiring level

Every Go button on Jobs, Food, Leisure, and Business pages was already correctly wired:

| Page | Buttons | onClick wired? | Calls mutation? | Sends API request? |
|------|---------|---------------|----------------|--------------------|
| Jobs | N jobs x 2 shifts | Yes | Yes (`WORK_SHIFT`) | Yes (`POST /actions`) |
| Food | 5 meal qualities | Yes | Yes (`EAT_MEAL`) | Yes (`POST /actions`) |
| Leisure | 2 (Leisure + Social Call) | Yes | Yes (`LEISURE`, `SOCIAL_CALL`) | Yes (`POST /actions`) |
| Business | Start Production per recipe | Yes | Yes (`BUSINESS_START_PRODUCTION`) | Yes (`POST /actions`) |
| Business | Register | Yes | Yes (`BUSINESS_REGISTER`) | Yes (`POST /actions`) |

### The real problems

1. **No success feedback**: `useSubmitAction.onSuccess` only invalidated queries silently.
   No toast, no visual indicator. User clicks Go, spinner shows briefly, then... nothing visible.

2. **Action Queue component existed but was never rendered**: `ActionQueue` component
   (`components/action-queue.tsx`) was fully implemented but not imported or used in any
   layout, page, or shell. Users had no way to see their queued/running/completed actions.

3. **Network errors were unhandled**: `fetch()` throwing (network down, DNS failure) was
   not caught, leading to unhandled promise rejections instead of user-facing error messages.

4. **No global mutation error fallback**: Mutations without explicit `onError` handlers
   would fail silently.

5. **Error messages were generic**: All API errors showed just `error.message` without
   context about what action failed or what category of error it was.

## Changes Made

### 1. `apps/web/src/hooks/use-submit-action.ts` — Success toast + better errors

- Added `onSuccess` toast: `"Queued: <action label>"` on every successful enqueue
- Added human-readable action labels map (WORK_SHIFT -> "Work shift", etc.)
- Improved error toasts with action context and error categorization:
  - Network errors: `"<action> failed: Network error — check your connection"`
  - Auth errors: `"<action> failed: Session expired — please log in again"`
  - Server errors: `"<action> failed: Server error (500) — try again later"`
  - Domain errors: `"<action> failed: <specific message>"`

### 2. `apps/web/src/lib/api.ts` — Network error handling + API log

- Wrapped `fetch()` in try/catch to convert network failures into `ApiError(0, 'NETWORK_ERROR', ...)`
- Added `apiLog` ring buffer (last 20 API requests with method, path, status, error, timestamp)
- All requests (success and error) are now logged for debugging visibility

### 3. `apps/web/src/components/providers.tsx` — Global mutation error handler

- Added `MutationCache` with global `onError` callback
- Any mutation without its own `onError` will now show a toast automatically
- Prevents silent failures for any future mutations

### 4. `apps/web/src/components/action-queue-dropdown.tsx` — New Queue UI

- Persistent "Queue" dropdown button in the top bar
- Shows badge count of active (running + pending) actions
- Running action with elapsed time countdown
- Pending/scheduled actions list
- Last completed action with timestamp
- Last failed action indicator

### 5. `apps/web/src/components/game-shell.tsx` — Queue integration

- Added `ActionQueueDropdown` to the top bar between balance and daily timer
- Always visible, works on both desktop and mobile

### 6. `apps/web/src/components/dev-debug-panel.tsx` — DEV debug panel

- Only renders in `NODE_ENV === 'development'`
- Fixed-position bug icon button (bottom-right)
- Shows last 20 API requests with status codes, methods, paths, timestamps
- Color-coded: green for success, red for errors

### 7. `apps/web/src/app/(game)/layout.tsx` — Debug panel integration

- Added `DevDebugPanel` to the game layout

### 8. `apps/web/src/app/(game)/settings/page.tsx` — Enhanced API status

- Added recent API errors display below the connection status indicator

## How to Verify

### Quick smoke test (< 1 minute)

1. Open the app in a browser, log in
2. Navigate to **Jobs** page
3. Click any "Go" button
4. **Expected**: Toast appears bottom-right: `"Queued: Work shift"`
5. Check the **Queue** button in the top bar — it should show "1" badge and the running action
6. Navigate to **Food** page, click "Go" on Street Food
7. **Expected**: Toast: `"Queued: Eat meal"`
8. Navigate to **Leisure** page, click "Go" on either action
9. **Expected**: Toast: `"Queued: Leisure"` or `"Queued: Social call"`

### Error feedback test

1. Disconnect network / stop API server
2. Click any "Go" button
3. **Expected**: Toast: `"<action> failed: Network error — check your connection"`

### Queue panel test

1. Perform a few actions
2. Click the "Queue" button in top bar
3. **Expected**: See running/pending/completed actions with timestamps

### Debug panel test (dev mode only)

1. Run `pnpm dev` (development mode)
2. Click the bug icon (bottom-right corner)
3. **Expected**: See last API requests with status codes

### Settings page

1. Navigate to Settings
2. **Expected**: API Status card shows "Connected" with green dot
3. If any errors occurred, they appear as "Recent errors" below

## Test Coverage

New test file: `apps/web/src/__tests__/action-feedback.test.ts`

- **4 tests**, all passing:
  1. Shows success toast when action is queued
  2. Shows error toast on API validation error (400)
  3. Shows network error toast on fetch failure
  4. Shows server error toast on 500
