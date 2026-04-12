

# Mother Bot — Multi-Bot Creation Platform

## Overview
A new Telegram bot ("Mother Bot") that allows anyone to create their own branded selling bot. Each created bot operates independently with its own users, but all products come from the main store and all orders are processed by the main admin. Bot owners earn a configurable revenue percentage (1–60%) on every sale.

## Architecture

```text
┌──────────────────────────────────────────────────────┐
│                    Mother Bot                         │
│  /start → Join Channels → Main Menu                  │
│  [My Bots] [Create a Bot] [Help] [Earnings]          │
└──────────────┬───────────────────────────────────────┘
               │ Creates
               ▼
┌──────────────────────────────────────────────────────┐
│              Child Bot (Dynamic)                      │
│  Runs on: mother-bot edge function with ?bot=<id>     │
│  Products: Same as main store                         │
│  Orders: Forwarded to main bot admins                 │
│  Delivery: Product credentials only (no website link) │
│  Revenue: X% of each sale → bot owner's wallet        │
└──────────────────────────────────────────────────────┘
```

## Database Changes (Migration)

### New Tables

**1. `mother_bot_users`** — Users who interact with the Mother Bot
- `id` (uuid, PK)
- `telegram_id` (bigint, unique)
- `username`, `first_name`, `last_name` (text)
- `created_at`, `last_active` (timestamptz)

**2. `child_bots`** — Bots created through the Mother Bot
- `id` (uuid, PK)
- `bot_token` (text, encrypted/stored)
- `bot_username` (text)
- `owner_telegram_id` (bigint) — the creator
- `revenue_percent` (numeric, 1–60)
- `is_active` (boolean, default true)
- `total_earnings` (numeric, default 0)
- `total_orders` (integer, default 0)
- `created_at` (timestamptz)

**3. `child_bot_users`** — Users of each child bot
- `id` (uuid, PK)
- `child_bot_id` (uuid, FK → child_bots)
- `telegram_id` (bigint)
- `username`, `first_name` (text)
- `created_at`, `last_active` (timestamptz)
- UNIQUE(child_bot_id, telegram_id)

**4. `child_bot_orders`** — Orders through child bots (linked to main orders)
- `id` (uuid, PK)
- `child_bot_id` (uuid, FK → child_bots)
- `main_order_id` (uuid) — links to `orders` table
- `buyer_telegram_id` (bigint)
- `product_name` (text)
- `total_price` (numeric)
- `owner_commission` (numeric)
- `status` (text: pending/confirmed/rejected/delivered)
- `created_at` (timestamptz)

**5. `child_bot_earnings`** — Earnings log for bot owners
- `id` (uuid, PK)
- `child_bot_id` (uuid, FK → child_bots)
- `order_id` (uuid, FK → child_bot_orders)
- `amount` (numeric)
- `status` (text: pending/paid)
- `created_at` (timestamptz)

### RLS Policies
- All tables: `USING (false)` for public + service role full access (edge functions use service role)
- Admin SELECT policies on all tables for website admin panel visibility

## Edge Function: `mother-bot/index.ts`

### Mother Bot Flow (English only)

**1. /start**
- Upsert user in `mother_bot_users`
- Check channel membership (uses main bot's required channels from `app_settings`)
- Show main menu: `[🤖 My Bots] [➕ Create a Bot] [💰 Earnings] [❓ Help]`

**2. Create a Bot flow** (conversation state)
- Step 1: "Send your Bot API Token (get from @BotFather)"
- Validate token via `getMe` API call
- Step 2: "Enter Owner Telegram ID" (who will control this bot)
- Step 3: "Enter your revenue percentage per sale (1% – 60%)"
- Validate range
- Step 4: Show confirmation with bot username, owner ID, percentage → [✅ Confirm] [❌ Cancel]
- On confirm:
  - Save to `child_bots` table
  - Set webhook for child bot → `{SUPABASE_URL}/functions/v1/mother-bot?bot={child_bot_id}`
  - Send success message

**3. My Bots** — List user's created bots with stats
**4. Earnings** — Show total earnings, pending payouts
**5. Help** — Forward to main bot support text

### Child Bot Handling (same edge function, routed by `?bot=<id>`)

When `?bot=<id>` query param is present:
- Look up `child_bots` by id, get token
- Verify webhook request matches the bot token
- Handle like a mini store bot:
  - /start → channel check → menu with products
  - Product browsing (from main `products` table)
  - Purchase flow (wallet/UPI/Binance — same payment methods)
  - Orders go to main `orders` table with `origin_bot = 'child'` and `child_bot_id`
  - On order confirmation by main admin → notify buyer via child bot token
  - Calculate commission → credit to `child_bot_earnings`
  - **No website link** in delivery — only product credentials/access link
  - Bot owner has admin panel for their bot (view users, orders, earnings)

## Improvements I'll Add

1. **Bot Owner Dashboard** — `/admin` in child bot shows: My Users, My Orders, My Earnings, Bot Settings
2. **Withdraw System** — Bot owners can request withdrawal of earned commissions
3. **Auto-webhook setup** — Webhook is auto-configured when bot is created
4. **Bot status management** — Mother Bot creator can deactivate/reactivate bots
5. **Anti-abuse** — Rate limit bot creation (max 3 bots per user), validate bot tokens
6. **Main Admin Override** — Main admin can see all child bots and their stats from website admin panel

## Website Admin Panel Changes

Add a **"Mother Bot"** tab in `AdminBotTabs.tsx`:
- List all child bots with stats (users, orders, earnings, revenue %)
- Ability to activate/deactivate child bots
- View child bot orders and commissions
- Manage payout requests from bot owners

## Files to Create/Modify

### New Files
1. `supabase/functions/mother-bot/index.ts` — Main Mother Bot edge function (handles both mother and child bot requests)
2. `src/components/admin/MotherBotManager.tsx` — Admin panel UI for managing child bots

### Modified Files
1. `supabase/migrations/new_migration.sql` — Create 5 new tables + RLS
2. `src/components/admin/AdminBotTabs.tsx` — Add "Mother Bot" tab
3. `supabase/functions/telegram-set-webhook/index.ts` — Add MOTHER_BOT_TOKEN webhook setup
4. `supabase/functions/telegram-bot/payment/admin-actions.ts` — When main admin confirms order, check if it's a child bot order and notify via child bot + calculate commission

## Secret Required
- `MOTHER_BOT_TOKEN` — The Mother Bot's Telegram bot token (user needs to create a bot via BotFather first)

## Estimated Scope
This is a large feature (~800-1000 lines of edge function code + ~300 lines of admin UI + migration). I'll implement it in stages:
1. Database tables + migration
2. Mother Bot edge function (create bot flow)
3. Child Bot dynamic handler (product browsing, ordering)
4. Order integration with main bot (commission calculation)
5. Website admin panel (MotherBotManager)

