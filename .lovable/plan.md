# ChatGPT Plus / 2FA Account Auto-Delivery System

## Goal
Email + Password + 2FA secret — তিনটাই একটা স্টক আইটেমে রেখে অটো-ডেলিভার করা। Buyer Order page-এ গিয়ে live 6-digit OTP দেখতে পারবে, আলাদা Authenticator app লাগবে না।

---

## What will be built

### 1. Admin: Multi-line Stock Input + Bulk Import
**File:** `src/components/admin/modals/VariationDeliveryManager.tsx` & `src/pages/ProductEditPage.tsx`
- Stock add textarea-কে 4 rows করে multi-line friendly করা
- Placeholder: `Email: user@example.com\nPassword: MyPass123\n2FA: JBSWY3DPEHPK3PXP`
- নতুন **"Bulk Import"** button — modal-এ ১০০টা account একসাথে paste করা যাবে, প্রতিটা `---` দিয়ে আলাদা
- Stock list-এ প্রতিটা item-এর preview সুন্দর করে multi-line দেখানো হবে

### 2. Smart Credential Parser (Shared Utility)
**New file:** `src/lib/credentialParser.ts`
পরিচয় করবে এই formats:
- `Email: x\nPassword: y\n2FA: z` (labeled)
- `x|y|z` (pipe-separated)
- `x:y:z` (colon-separated)
- শুধু URL → as-is delivery link
Returns: `{ email?, password?, twoFASecret?, link?, raw }`

### 3. Order Page: Per-Field Copy + Live TOTP Generator ⭐
**File:** `src/components/orders/OrderCard.tsx`
- access_link parse করে দেখাবে:
  - 📧 Email field + Copy button
  - 🔑 Password field + reveal/copy button
  - 🔐 **2FA section** — current 6-digit OTP large দেখাবে, প্রতি 30 সেকেন্ডে auto-refresh, circular progress bar (কতক্ষণ valid), Copy OTP button
  - 🔗 Link থাকলে Open button
- TOTP client-side generate হবে (`otpauth` npm package, ~7KB)

### 4. Bot Delivery Format Update
**File:** `supabase/functions/telegram-bot/payment/instant-delivery.ts`
- Multi-line credential হলে `<pre>` block-এ format করে পাঠাবে যাতে Telegram-এ tap-to-copy কাজ করে
- 2FA secret থাকলে message-এ একটা note: *"💡 Open your order on the website to see live 2FA code"* + website link

### 5. Dependencies
- `otpauth` package add (TOTP generation)

---

## Files to Edit/Create

| File | Action |
|------|--------|
| `package.json` | Add `otpauth` |
| `src/lib/credentialParser.ts` | **New** — parsing utility |
| `src/lib/totpGenerator.ts` | **New** — TOTP wrapper hook |
| `src/components/admin/modals/VariationDeliveryManager.tsx` | Multi-line UI + Bulk import |
| `src/components/admin/modals/BulkStockImportModal.tsx` | **New** modal |
| `src/pages/ProductEditPage.tsx` | Same UI improvement for product-level stock |
| `src/components/orders/OrderCard.tsx` | Credential display + TOTP widget |
| `src/components/orders/CredentialDisplay.tsx` | **New** — reusable credential viewer |
| `supabase/functions/telegram-bot/payment/instant-delivery.ts` | Better formatting |

**No DB schema changes needed** — existing `access_link TEXT` field handles everything.

---

## How Admin will use it

1. ChatGPT Plus product → variation → Toggle **Auto Delivery** on
2. Click **Bulk Import** → paste 50টা account (each separated by `---`):
   ```
   Email: acc1@gmail.com
   Password: Pass@123
   2FA: JBSWY3DPEHPK3PXP
   ---
   Email: acc2@gmail.com
   Password: Pass@456
   2FA: NB2W45DFOIYAJBSW
   ---
   ...
   ```
3. Save → ৫০টা stock item তৈরি
4. Buyer purchase করার সাথে সাথে একটা অটো-deliver হবে

## How Buyer will see it (Order page)

```
✅ Account Delivered

📧 Email          [acc1@gmail.com]    [Copy]
🔑 Password       [••••••••]   [👁]   [Copy]
🔐 2FA Code       [ 384 027 ]         [Copy]
                  ⏱ Refreshes in 18s
```

---

## Approval needed
Approve করলে আমি implement শুরু করব।