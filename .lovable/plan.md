

# Advanced Bilingual Telegram E-commerce Bot - Complete Overhaul

## Overview
A major upgrade to the existing Telegram bot adding bilingual support (English/Bengali), AI assistant, forced channel subscription, bot-internal wallet system, reseller system, and enhanced product browsing with variations.

---

## 1. Database Changes (New Tables + Modifications)

### New Table: `telegram_wallets`
Stores bot-internal wallet balance per Telegram user.
- `id` (uuid, PK, default gen_random_uuid())
- `telegram_id` (bigint, unique, not null)
- `balance` (numeric, default 0)
- `total_earned` (numeric, default 0)
- `referral_code` (text, unique) -- auto-generated
- `referred_by` (bigint, nullable) -- referrer's telegram_id
- `is_reseller` (boolean, default false)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### New Table: `telegram_wallet_transactions`
Tracks all wallet movements (referral bonuses, resale profits, deductions).
- `id` (uuid, PK)
- `telegram_id` (bigint, not null)
- `type` (text: referral_bonus, resale_profit, purchase_deduction, admin_credit)
- `amount` (numeric)
- `description` (text)
- `created_at` (timestamptz, default now())

### New Table: `telegram_resale_links`
Stores reseller-generated custom links.
- `id` (uuid, PK)
- `reseller_telegram_id` (bigint, not null)
- `product_id` (uuid, not null)
- `variation_id` (uuid, nullable)
- `custom_price` (numeric, not null)
- `reseller_price` (numeric, not null) -- snapshot at creation
- `link_code` (text, unique) -- short unique code
- `is_active` (boolean, default true)
- `uses` (integer, default 0)
- `created_at` (timestamptz, default now())

### Modify Table: `telegram_bot_users`
Add column:
- `language` (text, default null) -- 'en' or 'bn', null = not chosen yet

### RLS: All new tables use service-role-only access (same as existing telegram tables).

---

## 2. Edge Function Rewrite: `telegram-bot/index.ts`

### Architecture Changes

**Bilingual System:**
- A `translations` object with keys for every bot message in both `en` and `bn`.
- `getUserLang(supabase, telegramId)` function returns saved language or null.
- If language is null, show language selection menu before anything else.
- Language choice callback: `lang_en`, `lang_bn` -- saves to `telegram_bot_users.language`.

**Forced Channel Subscription:**
- Before any feature access, check membership in both channels using Telegram `getChatMember` API.
- If not joined, show "Join & Verify" button with links to both channels plus a "I've Joined - Verify" callback.
- Verification callback re-checks membership and proceeds or shows error.

**AI Assistant:**
- Use Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) for answering queries.
- System prompt includes: product catalog context, "No Return Policy" strict rule, and fallback to admin forwarding.
- Triggered when user sends a question-like message (non-command, non-photo, contains "?").
- Uses `LOVABLE_API_KEY` (already configured as secret).

**Bot Wallet System:**
- `my_wallet` callback now shows bot-internal wallet balance from `telegram_wallets`.
- On `/start` or first interaction, auto-create wallet with unique referral code (e.g., `REF` + 6 random chars).
- Referral link format: `https://t.me/Cheapest_Premiums_bot?start=ref_CODE`.
- When a referred user makes a first purchase, referrer gets bonus (configurable via `app_settings`).

**Enhanced Buy Flow with Wallet Deduction:**
- When user clicks "Buy Now" on a product/variation:
  1. Show price breakdown: Original Price, Wallet Balance, Final Payable Amount.
  2. If wallet covers full amount, offer "Pay with Wallet" button.
  3. Otherwise, show QR code image, UPI link, and exact remaining amount.
  4. User sends payment screenshot -> forwarded to admin with action buttons.

**Multi-Level Product Menu:**
- View Products -> Show Categories (from `categories` table) as buttons.
- Click Category -> Show products in that category.
- Click Product -> Show variations with individual prices.
- Click Variation -> Show buy flow for that specific variation.

**Reseller System:**
- Admin can `/make_reseller <telegram_id>` to grant reseller status.
- Resellers see a "Resale" button on product details.
- Clicking "Resale" enters a conversation flow: user enters custom price (must be > reseller_price).
- Bot generates a unique resale link stored in `telegram_resale_links`.
- When a buyer uses this link, profit = custom_price - reseller_price is credited to reseller's wallet.

### New/Modified Handlers

| Handler | Description |
|---------|-------------|
| `handleLanguageSelection` | Save language preference, proceed to forced join check |
| `handleForcedJoinCheck` | Verify channel membership via getChatMember API |
| `handleVerifyJoin` | Re-check membership on button click |
| `handleAIQuery` | Send question to Lovable AI, return answer or offer admin forward |
| `handleBotWallet` | Show wallet balance, referral code, transaction history |
| `handleBuyWithWallet` | Calculate wallet deduction, show payment breakdown |
| `handleResaleButton` | Start resale flow for resellers |
| `handleResalePrice` | Conversation step for custom price entry |
| `handleResaleLink` | Generate and return unique resale link |
| `handleStartWithRef` | Parse `/start ref_CODE`, save referral relationship |
| `/make_reseller` | Admin command to toggle reseller status |
| `/stats` | Alias for `/report` with enhanced metrics |

### Existing Handlers (Preserved & Enhanced)
All existing handlers (`handleStart`, `handleViewProducts`, `handleProductDetail`, `handleBuyProduct`, admin commands) are preserved but enhanced with:
- Bilingual message output based on user language
- Forced join check wrapper
- Wallet integration in buy flow

---

## 3. Admin Panel Update: `AdminTelegramBot.tsx`

Update the web admin component to reflect:
- New features list (bilingual, AI, wallet, reseller)
- Display wallet stats and reseller count from new tables
- Updated command reference including `/make_reseller`, `/stats`

---

## 4. Message Flow

```text
User sends /start
    |
    v
Language chosen? --no--> Show EN/BN selection
    |yes
    v
Channels joined? --no--> Show "Join & Verify" with channel links
    |yes
    v
Parse ref code if present -> save referral
    |
    v
Show main menu (bilingual)
    |
    v
[View Products] -> Categories -> Products -> Variations -> Buy Flow
    |                                                         |
    |                                                    Wallet deduction
    |                                                    + Payment info
    |                                                    + Screenshot upload
    |                                                         |
    |                                                    Forward to Admin
    |                                                    + Action buttons
    v
[My Wallet] -> Balance, Referral Code, History
[Resale] (resellers only) -> Custom price -> Generate link
[AI Query] -> Lovable AI -> Answer or forward to admin
```

---

## 5. Technical Details

- **Single file**: All logic in `supabase/functions/telegram-bot/index.ts`
- **AI integration**: Via Lovable AI Gateway using pre-configured `LOVABLE_API_KEY`
- **Channel verification**: Telegram `getChatMember` API for @pocket_money27 and @RKRxOTT
- **Referral tracking**: Via `/start ref_CODE` deep links
- **Resale links**: Generated as `t.me/Cheapest_Premiums_bot?start=buy_LINKCODE`
- **Language persistence**: Stored in `telegram_bot_users.language` column
- **No breaking changes**: All existing functionality preserved

## 6. Files to Create/Modify

| File | Action |
|------|--------|
| Database migration | Create 3 new tables, alter `telegram_bot_users` |
| `supabase/functions/telegram-bot/index.ts` | Major rewrite (~1500 lines) |
| `src/components/admin/AdminTelegramBot.tsx` | Update features & stats display |

