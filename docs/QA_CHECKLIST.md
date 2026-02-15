# QA Checklist — Repeatable Regression Testing

Use this checklist before every release. Each section has manual test steps and expected outcomes.
Mark pass/fail and note any deviations.

---

## 1. Register / Login

### 1.1 Register (new account)
- [ ] Navigate to `/register`
- [ ] Enter valid username (3-50 chars), valid password (8+ chars, 1 upper, 1 lower, 1 digit)
- [ ] Submit the form
- [ ] **Expected:** Redirected to game page. Wallet shows 500.00 BCE initial grant. All vigor bars at 100. Housing tier = Shelter.
- [ ] Verify username appears in header/settings
- [ ] Verify timezone was captured (check DB: `SELECT timezone FROM players WHERE username = '...'`)

### 1.2 Register (validation errors)
- [ ] Try username < 3 chars → error shown
- [ ] Try password < 8 chars → error shown
- [ ] Try password without uppercase → error shown
- [ ] Try duplicate username → error shown (should NOT reveal if username exists)

### 1.3 Login (existing account)
- [ ] Navigate to `/login`
- [ ] Enter valid credentials
- [ ] **Expected:** Redirected to game. Player state restored (vigor, wallet, skills all match previous session)
- [ ] Verify session cookie is set (DevTools → Application → Cookies → `session_id`)

### 1.4 Login (bad credentials)
- [ ] Wrong password → "Invalid credentials" error
- [ ] Non-existent username → same generic error (no user enumeration)

### 1.5 Logout
- [ ] Click logout (Settings page or wherever available)
- [ ] **Expected:** Redirected to `/login`. Session cookie cleared.
- [ ] Navigate to any game page → redirected to login

### 1.6 Guest Login (ITCH_MODE)
- [ ] Set `NEXT_PUBLIC_API_URL` to enable ITCH_MODE
- [ ] Open app fresh (no localStorage)
- [ ] **Expected:** Guest account auto-created. Bearer token in localStorage. Game loads with initial state.
- [ ] Refresh page → still authenticated (token persisted)

---

## 2. Eat Meal

### 2.1 Buy a meal (each quality)
- [ ] Navigate to Food page
- [ ] For each quality (Street Food, Home Cooked, Restaurant, Fine Dining, Nutrient Optimal):
  - [ ] Click "Go" / submit
  - [ ] **Expected:** Wallet deducted by correct amount. Toast confirmation. `mealsEatenToday` increments.
  - [ ] Verify vigor buff appears (check Vigor page for active buffs)

### 2.2 Meal limit
- [ ] Eat 3 meals in one day
- [ ] Try to eat a 4th
- [ ] **Expected:** Rejected with "Maximum meals reached" or similar

### 2.3 Insufficient funds
- [ ] With low balance, try to buy Fine Dining (30 BCE)
- [ ] **Expected:** Button disabled or clear error message. No wallet deduction.

### 2.4 Meal preview
- [ ] Check preview for each meal quality
- [ ] **Expected:** Shows vigor gain (both instant and buff projections). Shows cost.

---

## 3. Take Leisure

### 3.1 Submit leisure action
- [ ] Navigate to Leisure page
- [ ] Click "Go"
- [ ] **Expected:** Action queued (1-hour duration). Confirmation toast.
- [ ] After resolution: MV +4, SpV +2 instant delta applied. Buff created (MV +1/hr, SpV +0.5/hr for 3 hours).

### 3.2 Leisure while sleeping
- [ ] Start a sleep action
- [ ] Try to submit leisure
- [ ] **Expected:** Rejected (should not be allowed while sleeping)

### 3.3 Leisure with zero vigor
- [ ] Deplete a vigor dimension to 0
- [ ] Try leisure
- [ ] **Expected:** Blocked by hard lockout if relevant dimension is 0

---

## 4. Do a Job Shift

### 4.1 Submit work shift (each family)
- [ ] Navigate to Jobs page
- [ ] For each family (Physical, Admin, Service, Management) and duration (Short 2h, Full 8h):
  - [ ] Click "Go"
  - [ ] **Expected:** Action queued with correct duration. On resolution: wallet credited with pay, vigor deducted, skill XP earned.

### 4.2 Work shift while sleeping
- [ ] Start sleep. Try to submit work shift.
- [ ] **Expected:** Rejected with "Cannot work while sleeping"

### 4.3 Pay calculation
- [ ] Complete a full physical shift
- [ ] **Expected:** Pay = BaseWage × Performance × (hours/8). Performance based on skill level and vigor. Pay appears in wallet.

### 4.4 Skill XP gain
- [ ] Note skill level before shift
- [ ] Complete shift
- [ ] **Expected:** Relevant skill increased. XP gain diminishes as skill approaches 2.0 cap.

---

## 5. Change Housing

### 5.1 Upgrade housing tier
- [ ] Navigate to Bills page
- [ ] Select a higher housing tier (e.g., Cheap Room → Studio)
- [ ] **Expected:** Confirmation shown. Housing tier updated. New daily rent visible. Vigor regen bonuses applied on next tick.

### 5.2 Insufficient funds for rent
- [ ] Set housing tier above what wallet can sustain
- [ ] Wait for daily tick
- [ ] **Expected:** Auto-downgrade to affordable tier. Discomfort penalty applied (PV -3, SV -2). Wallet never negative.

### 5.3 Housing regen bonuses
- [ ] Compare vigor regen rates at Shelter vs. Comfortable
- [ ] **Expected:** Higher tiers show higher PV/MV/SV regen. Check Vigor page for current bonuses.

---

## 6. Check Daily Reset Countdown

### 6.1 Timer display
- [ ] Observe daily reset timer on any game page
- [ ] **Expected:** Shows hours, minutes, seconds until next local midnight. Counts down in real-time.
- [ ] Timer should NOT display fractional seconds

### 6.2 Timer expiry
- [ ] Watch timer reach 0:00:00
- [ ] **Expected:** Timer resets to ~24:00:00 for next day. Meal counter resets. Penalty level updated.

### 6.3 Timer across tab switches
- [ ] Note timer value. Switch tabs for 5 minutes. Return.
- [ ] **Expected:** Timer shows correct remaining time (not frozen at old value)

---

## 7. Refresh Page / Open in New Tab

### 7.1 Page refresh
- [ ] On any game page, press F5 / Cmd+R
- [ ] **Expected:** Page reloads. User still authenticated. All state preserved (vigor, wallet, queue, housing).

### 7.2 New tab
- [ ] Copy current URL. Open in new tab.
- [ ] **Expected:** Same authenticated state. No "please login" flash.

### 7.3 Browser back/forward
- [ ] Navigate: Food → Jobs → Market. Press Back twice, then Forward.
- [ ] **Expected:** Navigation works correctly. No white screen or stale data.

### 7.4 Hard refresh (Ctrl+Shift+R)
- [ ] Hard refresh the page
- [ ] **Expected:** Cache bypassed. Latest version loaded. Still authenticated.

### 7.5 Multiple tabs
- [ ] Open game in two tabs. Perform action in tab 1.
- [ ] Switch to tab 2 after a moment.
- [ ] **Expected:** Tab 2 shows updated state on next poll/refetch.

---

## 8. Slow Network Simulation

### 8.1 Slow 3G simulation
- [ ] Open DevTools → Network → Throttling → Slow 3G
- [ ] Navigate between pages
- [ ] **Expected:** Loading skeletons shown. No uncaught errors. Pages eventually load.

### 8.2 Action submission on slow network
- [ ] On Slow 3G, submit an eat meal action
- [ ] **Expected:** Button shows loading state. No double-submit possible. Eventually succeeds or shows error.

### 8.3 Offline then online
- [ ] Switch to Offline in DevTools Network
- [ ] Try to navigate or submit an action
- [ ] **Expected:** Graceful error shown (not white screen).
- [ ] Switch back to Online
- [ ] **Expected:** App recovers. Data refreshes.

### 8.4 Request timeout
- [ ] If possible, simulate a request that takes > 30 seconds
- [ ] **Expected:** User sees a timeout error message. No hung UI.

---

## 9. Action Queue

### 9.1 Queue an action
- [ ] Submit a timed action (e.g., work shift, sleep)
- [ ] **Expected:** Action appears in queue (Summary page or action queue component). Status shows as scheduled/running.

### 9.2 Queue limit
- [ ] Queue 12 actions
- [ ] Try to queue a 13th
- [ ] **Expected:** Rejected with "Queue full" message

### 9.3 Action resolution
- [ ] Wait for a queued action to resolve (fast-forward if possible)
- [ ] **Expected:** Status changes to completed. Effects applied (vigor, wallet, skills). Action removed from active queue.

### 9.4 Queue display at limit
- [ ] Queue 12+ items
- [ ] **Expected:** Queue shows all items or "and X more" indicator. No silent truncation.

---

## 10. Market (if accessible)

### 10.1 View goods list
- [ ] Navigate to Market page
- [ ] **Expected:** All 9 goods displayed with current reference prices

### 10.2 Place limit order
- [ ] Place a buy limit order for RAW_FOOD
- [ ] **Expected:** Order appears in "My Orders" list. Wallet not immediately debited (note: this is current behavior, though escrow would be better).

### 10.3 Cancel order
- [ ] Cancel a pending order
- [ ] **Expected:** Order removed from "My Orders". If sell order, inventory returned.

### 10.4 View order book
- [ ] Click into a good's detail
- [ ] **Expected:** Bids and asks displayed. Reference price shown. Circuit breaker status if halted.

---

## 11. Business (if accessible)

### 11.1 Register business
- [ ] Navigate to Business page
- [ ] Register a new business
- [ ] **Expected:** 500 BCE deducted. Business appears in list. Assigned to a district.

### 11.2 Hire worker
- [ ] Hire an NPC worker with a wage
- [ ] **Expected:** Worker appears in business detail. Satisfaction starts at 1.0.

### 11.3 Start production
- [ ] With sufficient inventory and labor, start a production job
- [ ] **Expected:** Job appears in jobs list. Inputs deducted from inventory. On completion, outputs added.

---

## 12. Sleep

### 12.1 Start sleep
- [ ] Submit a sleep action
- [ ] **Expected:** Player state shows `sleep_state: sleeping`. Sleep icon or indicator visible.

### 12.2 Wake up
- [ ] After sleep duration completes
- [ ] **Expected:** `sleep_state` returns to `awake`. Vigor regenerated with sleep bonuses.

### 12.3 Actions while sleeping
- [ ] While sleeping, try to submit: work shift, leisure, social call
- [ ] **Expected:** All rejected. Eat meal and new sleep should also be handled gracefully.

---

## 13. PWA / Mobile

### 13.1 Install prompt
- [ ] On mobile Chrome, check for "Add to Home Screen" prompt
- [ ] **Expected:** Prompt appears. App icon correct. App name "Blueth City".

### 13.2 Home screen launch
- [ ] Launch from home screen
- [ ] **Expected:** Standalone mode (no browser chrome). Full-screen game experience.

### 13.3 Safe area handling
- [ ] On iPhone with notch/Dynamic Island
- [ ] **Expected:** Content not obscured by notch. Bottom nav respects safe area. No double padding.

### 13.4 Mobile navigation
- [ ] On mobile viewport, verify all 11 pages are reachable
- [ ] **Expected:** Bottom nav + hamburger menu cover all pages. No page orphaned.

### 13.5 Touch interactions
- [ ] Tap city map districts on mobile
- [ ] **Expected:** District selectable. Visual feedback on touch. No hover-only interactions.

---

## 14. Error Handling

### 14.1 API down
- [ ] Stop the API server. Load the game.
- [ ] **Expected:** Error message shown. No white screen of death.

### 14.2 Invalid session
- [ ] Delete session cookie manually. Refresh page.
- [ ] **Expected:** Redirected to login. No infinite redirect loop.

### 14.3 Server error response
- [ ] Trigger a 500 error (e.g., via malformed request)
- [ ] **Expected:** Toast or error message. No raw error JSON shown to user.

---

## 15. Deployment Smoke Test

### 15.1 Health endpoints
- [ ] `GET /health` → `{ status: 'ok' }`
- [ ] `GET /health/db` → `{ status: 'ok', latencyMs: ... }`
- [ ] `GET /ready` → `{ status: 'ready' }`

### 15.2 Version endpoint
- [ ] `GET /health` → Response includes `version` and `commit`
- [ ] **Expected:** Matches deployed build

### 15.3 Worker processes
- [ ] Verify scheduler worker is running (check logs for "Scheduler started")
- [ ] Verify tick worker is running (check logs for "Tick worker started")
- [ ] **Expected:** Both polling at configured intervals

### 15.4 Database connectivity
- [ ] API can reach database (health/db returns ok)
- [ ] Migrations have all been applied (check `_migrations` table)

---

## Notes

- **Environment:** Record browser, OS version, screen size, network conditions
- **Timing:** Note if tests were run during a tick window (hourly/6h/daily) as this may affect state
- **Screenshots:** Capture any UI anomalies for the bug backlog
- **Timezone:** Test with at least one non-Asia/Dubai timezone to verify daily reset timing
