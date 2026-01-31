

# Implementation Plan: Smart User Interaction and Advanced Search/Filtering

## Overview
This plan covers two major feature sets:
1. **Smart User Interaction** - Onboarding tour for new users + personalized product recommendations
2. **Advanced Search and Filtering** - Enhanced search for both users and admin panel

---

## Part 1: Smart User Interaction

### 1.1 User Onboarding Tour

**What it does:**
- Shows new users a guided tour of the app's key features
- Appears only once (on first login)
- Highlights: Home, Products, Wallet, Orders, Profile sections

**Components to create:**
- `src/components/OnboardingTour.tsx` - Main tour modal with step-by-step guide
- Uses localStorage to track if tour was shown

**Tour Steps:**
1. Welcome message with user's name
2. Browse Products section
3. Wallet - Add money and track balance
4. Orders - View purchase history
5. Profile - Manage settings and referrals

### 1.2 Personalized Product Recommendations

**What it does:**
- Analyzes user's order history to suggest similar products
- Shows "Products you might like" section on homepage
- Falls back to popular products for new users

**Database considerations:**
- Uses existing `orders` table to find user's purchase categories
- Uses existing `products` table to find similar products

**Components to create:**
- `src/components/PersonalizedRecommendations.tsx` - Smart product suggestions

---

## Part 2: Advanced Search and Filtering

### 2.1 User-Facing Product Search (Enhanced)

**Current state:** Basic text search + category filter exists in ProductsPage

**Enhancements:**
- Add price range slider
- Add stock availability filter (In Stock, Instant Delivery)
- Add sort options (Newest, Popular, Price Low-High, Price High-Low)
- Show helpful search prompt when results are empty

**Note:** `ProductSearchFilters.tsx` already exists with these features - needs integration

### 2.2 Admin Orders Advanced Search

**Current state:** Only status filter exists

**Enhancements:**
- Text search by order ID, product name, user name/email
- Date range filter
- Price range filter
- Sort by date, amount

**File to update:** `src/components/admin/AdminOrdersTab.tsx`

### 2.3 Admin Products Advanced Search

**Current state:** Only category filter exists

**Enhancements:**
- Text search by product name
- Filter by stock level (Low Stock, Out of Stock, In Stock)
- Filter by price range
- Sort by price, date, sales count

**File to update:** `src/components/admin/AdminProductsTab.tsx`

---

## Technical Details

### New Files to Create

| File | Purpose |
|------|---------|
| `src/components/OnboardingTour.tsx` | Guided tour modal for new users |
| `src/components/PersonalizedRecommendations.tsx` | AI-powered product suggestions |
| `src/components/admin/AdminAdvancedFilters.tsx` | Reusable filter component for admin |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add onboarding trigger + recommendations section |
| `src/pages/ProductsPage.tsx` | Integrate advanced filters |
| `src/components/admin/AdminOrdersTab.tsx` | Add search, date filter, sort |
| `src/components/admin/AdminProductsTab.tsx` | Add stock filter, search, sort |
| `src/components/admin/AdminUsersTab.tsx` | Add filter by deposit, orders count |

### Onboarding Tour Implementation

```text
+----------------------------------+
|     Welcome to RKR Premium!      |
|                                  |
|  [Step indicator: 1 of 5]        |
|                                  |
|  "Hey [Name], let me show you    |
|   around our premium store!"     |
|                                  |
|  [Skip]              [Next ->]   |
+----------------------------------+
```

### Personalized Recommendations Logic

```text
1. Fetch user's recent orders
2. Extract categories from orders
3. Find products in same categories (not already purchased)
4. If no orders, show top-selling products
5. Display as horizontal scroll section
```

### Admin Search Filter Layout

```text
+--------------------------------------------+
| Search: [________________] [Filter Icon]   |
+--------------------------------------------+
| Status: All | Pending | Processing | Done  |
| Date:   [Start Date] - [End Date]          |
| Price:  ₹[Min] - ₹[Max]                    |
| Sort:   Newest | Amount ↑ | Amount ↓       |
+--------------------------------------------+
```

---

## Implementation Sequence

1. Create OnboardingTour component
2. Create PersonalizedRecommendations component
3. Integrate both in Index.tsx
4. Enhance AdminOrdersTab with advanced filters
5. Enhance AdminProductsTab with stock/price filters
6. Enhance AdminUsersTab with additional filters
7. Test all features

---

## User Experience Flow

**New User Journey:**
1. User signs up/logs in for first time
2. Onboarding tour modal appears
3. User can skip or go through 5 steps
4. Tour completion saved to localStorage
5. Homepage shows personalized welcome

**Returning User Journey:**
1. User logs in
2. "Based on your purchases" section appears
3. Shows products similar to what they've bought
4. Easy access to advanced filters on Products page

**Admin Journey:**
1. Admin opens Orders tab
2. Sees search bar + filter pills
3. Can filter by date range, search by user
4. Quick access to specific order types

