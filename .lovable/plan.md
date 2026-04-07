

## Plan: Reservation-Based Unique Amount Deposit System

### Problem
Currently, unique `.xx` amounts are generated client-side with no reservation — two users could get the same amount, or a previously-verified payment could match again.

### New Flow
1. User enters base amount → clicks **Continue**
2. System shows **Confirm** screen with the unique amount (base + .xx paise)
3. User clicks **Confirm** → edge function reserves that exact amount in DB for 10 minutes (no other user can get the same `.xx` amount during this window)
4. User pays via Razorpay → auto-polling checks Razorpay API every 10 seconds
5. If a matching unclaimed payment (exact amount with `.xx`) is found within 10 minutes → auto-credit wallet, delete reservation
6. After 10 minutes or success → reservation expires/deletes

### Technical Steps

**1. New DB table: `razorpay_amount_reservations`**
- `id` (uuid, PK)
- `user_id` (uuid)
- `amount` (numeric) — the full unique amount with .xx
- `base_amount` (numeric) — the integer deposit amount
- `status` (text, default 'reserved') — reserved / completed / expired
- `deposit_request_id` (uuid, nullable)
- `created_at`, `expires_at` (timestamps)
- RLS: users can view own, service role manages all

**2. New edge function: `reserve-razorpay-amount`**
- Receives `{ userId, baseAmount }`
- Generates random `.xx` paise (scaled by amount: smaller deposits get smaller paise range)
- Checks DB for any existing unexpired reservation with the same full amount → if conflict, regenerates
- Inserts reservation with 10-min expiry
- Creates `manual_deposit_requests` record
- Returns `{ uniqueAmount, reservationId, depositRequestId }`

**3. Update `verify-razorpay-note` edge function**
- Accept `reservationId` instead of just `depositRequestId`
- On match: update reservation status to `completed`, delete/expire it, credit wallet
- Skip amounts that have active reservations belonging to OTHER users (prevents cross-user matching)

**4. Update `IndiaPaymentScreen.tsx` UI**
- **Step 1 (Amount)**: Enter amount → click "Continue"
- **Step 2 (Confirm)**: Show unique amount with `.xx` breakdown → click "Confirm" calls `reserve-razorpay-amount`
- **Step 3 (Pay)**: Show payment instructions, QR, Pay Now button, auto-polling
- Move unique amount generation from client-side to server-side (edge function)

**5. Paise scaling logic** (in edge function)
- Amount < ₹100: `.01 - .20` range
- Amount ₹100-499: `.01 - .50` range  
- Amount ₹500+: `.01 - .99` range

### Files to Create/Edit
- **Create**: Migration for `razorpay_amount_reservations` table
- **Create**: `supabase/functions/reserve-razorpay-amount/index.ts`
- **Edit**: `supabase/functions/verify-razorpay-note/index.ts` — use reservation system
- **Edit**: `src/components/wallet/deposit/IndiaPaymentScreen.tsx` — 3-step flow (Amount → Confirm → Pay)

