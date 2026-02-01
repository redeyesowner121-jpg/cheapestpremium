
# সম্পূর্ণ অ্যাপ্লিকেশন বিশ্লেষণ - চিহ্নিত বাগসমূহ

আমি সম্পূর্ণ অ্যাপ্লিকেশন পুঙ্খানুপুঙ্খভাবে বিশ্লেষণ করেছি এবং নিম্নলিখিত সমস্যাগুলো খুঁজে পেয়েছি:

---

## 🔴 Critical Bugs (অতি জরুরি)

### Bug #1: Coupon used_count আপডেট হচ্ছে না
**অবস্থান:** `src/components/product/PurchaseModal.tsx` এবং `src/pages/ProductDetailPage.tsx`

**সমস্যা:** কুপন ব্যবহার করলে `coupons` টেবিলে `used_count` বাড়ানো হচ্ছে না। শুধুমাত্র চেক করা হচ্ছে কিন্তু আপডেট হচ্ছে না।

**প্রভাব:** একই কুপন সীমাহীনবার ব্যবহার করা যাচ্ছে যদিও usage_limit সেট করা আছে।

**সমাধান:** Purchase সফল হলে coupon এর used_count +1 করতে হবে।

---

### Bug #2: Total Spent সবসময় ₹0.00 দেখাচ্ছে
**অবস্থান:** `src/pages/WalletPage.tsx` (Line 595-597)

**সমস্যা:** 
```typescript
<p className="text-primary-foreground font-semibold">₹0.00</p>
```
Total Spent হার্ডকোডেড ₹0.00 দেখাচ্ছে, আসল খরচ ক্যালকুলেট হচ্ছে না।

**সমাধান:** Purchase transactions এর মোট যোগ করে দেখাতে হবে।

---

### Bug #3: useOrderActions.ts এ Notification Message ভুল
**অবস্থান:** `src/hooks/admin/useOrderActions.ts` (Lines 53-54)

**সমস্যা:** Admin cancel করলে notification সবসময় বলছে "Refund added to wallet" এমনকি discount applied থাকলেও।
```typescript
case 'cancelled':
  notificationMessage = `...has been cancelled. Refund added to wallet.`;
```

**সমাধান:** hasDiscount এর উপর ভিত্তি করে dynamic message দেখাতে হবে (যেমন OrderModal.tsx তে আছে)।

---

## 🟠 High Priority Bugs

### Bug #4: Sold Count Race Condition
**অবস্থান:** `src/pages/ProductDetailPage.tsx` (Lines 257-268)

**সমস্যা:** দুইজন user একই সময়ে product কিনলে:
```typescript
sold_count: (displayProduct.sold_count || 0) + quantity
```
এটি stale data ব্যবহার করছে। দুজন একই সময়ে কিনলে sold_count ভুল হবে।

**সমাধান:** Supabase RPC function ব্যবহার করে atomic increment করতে হবে।

---

### Bug #5: Order Cancel করতে Discount Amount ফেরত হচ্ছে না
**অবস্থান:** `src/pages/OrdersPage.tsx` (Line 95)

**সমস্যা:** User cancel করলে `freshOrder.total_price` রিফান্ড হচ্ছে, কিন্তু সে `discount_applied` এর আগের amount পে করেছিল। অর্থাৎ user আসলে যা পে করেছে তার থেকে বেশি রিফান্ড পেতে পারে।

**বর্তমান কোড:**
```typescript
const newBalance = (profile.wallet_balance || 0) + freshOrder.total_price;
```

**সমাধান:** `total_price - discount_applied` রিফান্ড করতে হবে অথবা আলাদা `amount_paid` ফিল্ড রাখতে হবে।

---

### Bug #6: Admin User Modal এ Balance Edit এর Transaction Log নেই
**অবস্থান:** `src/components/admin/modals/UserModal.tsx`

**সমস্যা:** Admin যখন user এর wallet balance সরাসরি set করে, সেই পরিবর্তনের কোনো transaction record তৈরি হচ্ছে না। এতে:
- Audit trail নেই
- User বুঝতে পারে না কেন balance বদলেছে
- Accounting mismatch হতে পারে

**সমাধান:** Balance change এর সময় transaction insert করতে হবে।

---

## 🟡 Medium Priority Bugs

### Bug #7: Daily Bonus Timezone Issue
**অবস্থান:** `src/pages/ProfilePage.tsx` (Lines 53-54, 88-92)

**সমস্যা:**
```typescript
const today = new Date().toISOString().split('T')[0];
if (profile.last_daily_bonus === today) {
  toast.error('You have already claimed...');
}
```
UTC timezone ব্যবহার করছে। User IST (India) তে থাকলে রাত 12টার পর bonus claim করলে UTC অনুযায়ী পরের দিন গণনা হতে পারে।

**সমাধান:** Server-side timezone handling করতে হবে।

---

### Bug #8: Product Stock Update Race Condition (ProductsPage.tsx)
**অবস্থান:** `src/pages/ProductsPage.tsx`

**সমস্যা:** ProductsPage থেকে quick buy করলে stock check নেই। একই সময়ে একাধিক user buy করলে overselling হতে পারে।

**সমাধান:** Purchase এর আগে fresh stock check এবং database-level constraint যোগ করতে হবে।

---

### Bug #9: Flash Sale Price এ Rank Discount প্রয়োগ হচ্ছে না
**অবস্থান:** `src/pages/ProductDetailPage.tsx` (Lines 124-133)

**সমস্যা:** Flash sale product এ rank discount apply হচ্ছে না - এটা intentional কিনা স্পষ্ট না।
```typescript
// If flash sale, use flash sale price directly without rank discounts
```

**নোট:** এটা business decision - confirm করতে হবে flash sale তে rank discount থাকবে কি না।

---

### Bug #10: Referral Bonus Double Payment Possible
**অবস্থান:** `src/contexts/AuthContext.tsx` (Lines 137-152)

**সমস্যা:** Registration এ referral bonus দেওয়া হচ্ছে, আবার first deposit এ `razorpay-verify` edge function এ আরেকটা referral bonus দেওয়া হচ্ছে।

```typescript
// AuthContext.tsx - Registration এ
if (referralCode) {
  await supabase.from('profiles').update({
    wallet_balance: (referrer.wallet_balance || 0) + 10
  })...
}

// razorpay-verify/index.ts - First deposit এ
if (isFirstDeposit && profile.referred_by) {
  await supabase.from('profiles').update({
    wallet_balance: (referrer.wallet_balance || 0) + 10
  })...
}
```

**প্রভাব:** Referrer দুইবার ₹10 পাচ্ছে (একবার registration এ, একবার first deposit এ)।

**সমাধান:** একটি থেকে remove করতে হবে অথবা flag ব্যবহার করতে হবে।

---

### Bug #11: Google Login এ Duplicate Account Problem
**অবস্থান:** `src/contexts/AuthContext.tsx` (Lines 156-194)

**সমস্যা:** User প্রথমে email/password দিয়ে account করে, পরে same email এ Google login করলে নতুন password দিয়ে account create হবে। দুটো আলাদা authentication state।

**সমাধান:** Google login এ আগে check করতে হবে email already exists কিনা।

---

## 🟢 Low Priority / UI Issues

### Bug #12: Transaction Amount Display Inconsistency
**অবস্থান:** Database

**সমস্যা:** Database এ কিছু purchase এর amount 0.00 আছে:
```
Purchase: YouTube Premium - amount: 0.00 (ভুল!)
```
এটি আগের bug থেকে তৈরি হয়েছে যা ঠিক করা হয়েছে, কিন্তু old data ঠিক করা দরকার।

---

### Bug #13: "See All" Button Transactions এ কাজ করছে না
**অবস্থান:** `src/pages/WalletPage.tsx` (Line 680)

**সমস্যা:**
```tsx
<button className="text-sm text-primary font-medium">See All</button>
```
Button এ কোনো onClick handler নেই।

---

### Bug #14: Withdraw Button কাজ করছে না
**অবস্থান:** `src/pages/WalletPage.tsx` (Lines 608-614)

**সমস্যা:** Withdraw button এ কোনো functionality নেই।

---

## সংক্ষিপ্ত সারণি

| # | Bug | Severity | File |
|---|-----|----------|------|
| 1 | Coupon used_count update নেই | 🔴 Critical | PurchaseModal.tsx, ProductDetailPage.tsx |
| 2 | Total Spent হার্ডকোডেড | 🔴 Critical | WalletPage.tsx |
| 3 | Admin Cancel Notification ভুল | 🔴 Critical | useOrderActions.ts |
| 4 | Sold Count Race Condition | 🟠 High | ProductDetailPage.tsx |
| 5 | Refund Amount Calculation ভুল | 🟠 High | OrdersPage.tsx |
| 6 | Balance Edit এ Transaction Log নেই | 🟠 High | UserModal.tsx |
| 7 | Daily Bonus Timezone Issue | 🟡 Medium | ProfilePage.tsx |
| 8 | Stock Race Condition | 🟡 Medium | ProductsPage.tsx |
| 9 | Flash Sale + Rank Discount | 🟡 Medium | ProductDetailPage.tsx |
| 10 | Double Referral Bonus | 🟡 Medium | AuthContext.tsx, razorpay-verify |
| 11 | Google Login Duplicate | 🟡 Medium | AuthContext.tsx |
| 12 | Old Data with 0.00 amount | 🟢 Low | Database |
| 13 | See All Button | 🟢 Low | WalletPage.tsx |
| 14 | Withdraw Button | 🟢 Low | WalletPage.tsx |

---

## প্রস্তাবিত সমাধান পদক্ষেপ

### Phase 1: Critical Fixes
1. Coupon used_count increment যোগ করা
2. Total Spent calculation ঠিক করা
3. useOrderActions notification fix করা

### Phase 2: High Priority
4. Sold count atomic update (Supabase RPC)
5. Refund amount calculation fix
6. Admin balance edit transaction logging

### Phase 3: Medium Priority
7-11 নম্বর bugs ঠিক করা

### Phase 4: Low Priority & Cleanup
12-14 নম্বর issues ঠিক করা
