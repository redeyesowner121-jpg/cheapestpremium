

# App Performance Optimization Plan

## Problem Analysis

The app is slow because of several issues working together:

1. **Too many API calls on homepage** - The Index page alone triggers 5+ database queries, plus each child component (QuickStats, PersonalizedRecommendations, CategoryGrid, FlashSaleSlider, DailyBonusBanner, Header) makes its own separate API calls. That is 10+ network requests on page load.

2. **Heavy animations everywhere** - `framer-motion` animations with `initial/animate` on every stat card, banner, and section cause layout thrashing and slow rendering.

3. **Duplicate API calls** - Flash sales data is fetched multiple times (once in Index, again in FlashSaleSlider). App settings are fetched by multiple hooks independently. Profile and user_roles are fetched twice on auth state change.

4. **No lazy loading for pages** - All pages are imported eagerly in App.tsx, increasing the initial bundle size.

5. **DailyBonusBanner sparkle animations** - 6 infinitely repeating framer-motion sparkle animations running continuously.

6. **No memoization** - QuickStats, PersonalizedRecommendations, DailyBonusBanner are not memoized, causing unnecessary re-renders.

---

## Implementation Steps

### Step 1: Lazy load all pages in App.tsx
Use `React.lazy()` and `Suspense` for all page imports except Index. This reduces the initial JavaScript bundle significantly.

### Step 2: Remove heavy framer-motion animations
- **QuickStats**: Remove `motion.div` wrappers with `initial/animate` on every stat card. Use plain `div` elements instead.
- **DailyBonusBanner**: Remove the 6 sparkle `motion.div` elements with infinite animations. Keep simple fade-in only.
- **OnboardingTour**: Keep animations (modal, rarely shown).
- **Header**: Remove `motion.button` and `motion.img` -- use plain elements with CSS hover/active states.

### Step 3: Consolidate API calls on Index page
- Pass the already-fetched flash sales data directly to `FlashSaleSlider` (already done, but FlashSaleSlider still fetches coupons separately -- keep that but it is minor).
- Move `CategoryGrid` data fetching into the Index `loadData` function so categories load in the same `Promise.all`.
- Make `PersonalizedRecommendations` accept products as a prop from Index instead of fetching independently, or lazy-render it (only fetch when user scrolls to it).

### Step 4: Reduce QuickStats API calls
QuickStats independently fetches all orders to calculate savings. Instead, calculate savings lazily -- only when the user clicks the savings section, not on every page load. Remove the `useEffect` that auto-fetches savings.

### Step 5: Memoize components
Wrap `QuickStats`, `CategoryGrid`, `DailyBonusBanner`, `PersonalizedRecommendations` with `React.memo()`.

### Step 6: Deduplicate auth-related calls
In `AuthContext`, the `onAuthStateChange` and `getSession` both call `fetchProfile` and `checkAdminRole`, causing duplicate calls on initial load. Add a guard to prevent the double-fetch.

### Step 7: Defer non-critical components
Use `requestIdleCallback` or a simple delayed render for `OnboardingTour` and `PersonalizedRecommendations` so they don't block the initial paint.

---

## Technical Details

### Files to modify:
- `src/App.tsx` -- Add React.lazy imports
- `src/pages/Index.tsx` -- Consolidate data fetching, defer components
- `src/components/QuickStats.tsx` -- Remove animations, lazy-load savings
- `src/components/DailyBonusBanner.tsx` -- Remove sparkle animations
- `src/components/Header.tsx` -- Remove motion wrappers
- `src/components/PersonalizedRecommendations.tsx` -- Add React.memo
- `src/components/CategoryGrid.tsx` -- Accept data as prop option
- `src/contexts/AuthContext.tsx` -- Fix double fetch

### Expected improvement:
- Initial load: ~40-50% faster (fewer API calls + smaller bundle)
- Runtime performance: Smoother scrolling and interactions (no continuous animations)
- Network requests on homepage: Reduced from ~12 to ~6

