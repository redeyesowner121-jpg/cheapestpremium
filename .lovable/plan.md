

# Performance Fix - Eliminate Duplicate API Calls

## Root Cause

Looking at network requests, `app_settings` is fetched **5 times** on page load because `useAppSettings()` is called independently in multiple components (`AppContent`, `Header`, `DailyBonusBanner` claim handler). Each call creates its own fetch + realtime subscription.

Additionally, `CategoryGrid` and `PersonalizedRecommendations` each make separate API calls that could be consolidated.

## Changes

### 1. Create AppSettings Context (single fetch, shared across app)

**New file: `src/contexts/AppSettingsContext.tsx`**

Move the `useAppSettings` logic into a React Context provider so the settings are fetched once and shared everywhere. The `AppSettingsProvider` wraps the app in `App.tsx`, and all components use `useAppSettingsContext()` instead of the hook.

### 2. Update all consumers to use the shared context

**Files to update:**
- `src/App.tsx` -- Wrap with `AppSettingsProvider`, update `AppContent` to use context
- `src/components/Header.tsx` -- Switch from `useAppSettings()` to `useAppSettingsContext()`
- `src/components/DailyBonusBanner.tsx` -- Remove separate settings fetch in `handleClaimBonus`, use context instead
- Any other component using `useAppSettings`

### 3. Consolidate Index page data loading

**File: `src/pages/Index.tsx`**

Pass already-fetched categories data to `CategoryGrid` as a prop to eliminate its separate fetch. Add a `categories` prop to `CategoryGrid`.

### 4. Defer PersonalizedRecommendations

**File: `src/pages/Index.tsx`**

Wrap `PersonalizedRecommendations` in a deferred render (show after 500ms delay) so it does not block initial paint.

### 5. Add Vite dedupe config

**File: `vite.config.ts`**

Add `resolve.dedupe` for `react`, `react-dom` to prevent duplicate instances.

## Expected Result

- Network requests on homepage: reduced from ~12 to ~6
- `app_settings` fetched only **once** instead of 5 times
- Only **one** realtime subscription for settings instead of multiple
- Faster initial render with deferred non-critical components

## Technical Details

```text
Before:
  AppContent -> useAppSettings() -> fetch + subscribe
  Header -> useAppSettings() -> fetch + subscribe  
  DailyBonusBanner -> inline fetch in claim handler
  CategoryGrid -> fetch categories
  PersonalizedRecommendations -> fetch orders + products
  = 10+ API calls, 3+ realtime channels

After:
  AppSettingsProvider -> fetch once + 1 subscribe
  All components -> useAppSettingsContext() (no fetch)
  CategoryGrid -> receives data as prop from Index
  PersonalizedRecommendations -> deferred render
  = ~6 API calls, 1 realtime channel
```
