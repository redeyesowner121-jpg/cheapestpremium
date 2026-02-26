

# Professional Telegram E-commerce Bot - Super Admin Control System

## Overview
Complete overhaul of the Telegram bot to add Super Admin (ID: `6898461453`) exclusive controls, order forwarding with action buttons, live inventory management, broadcast, user management, and analytics -- all within Telegram itself.

## Database Changes

### New Table: `telegram_bot_users`
Stores every user who starts the bot (needed for broadcast and analytics).
- `id` (uuid, PK)
- `telegram_id` (bigint, unique, not null)
- `username` (text)
- `first_name` (text)
- `last_name` (text)
- `is_banned` (boolean, default false)
- `created_at` (timestamptz)
- `last_active` (timestamptz)

### New Table: `telegram_orders`
Tracks orders placed via Telegram with admin action status.
- `id` (uuid, PK)
- `telegram_user_id` (bigint)
- `username` (text)
- `product_name` (text)
- `product_id` (uuid, nullable)
- `amount` (numeric)
- `status` (text: pending/confirmed/rejected/shipped)
- `admin_message_id` (bigint, nullable) -- to track which forwarded message
- `screenshot_file_id` (text, nullable)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

RLS: Service role only (edge function uses service role key).

## Edge Function Rewrite: `telegram-bot/index.ts`

### Core Architecture

**Admin ID Constant:**
```text
const SUPER_ADMIN_ID = 6898461453;
```

**Admin Guard Function:**
```text
function isAdmin(userId: number): boolean {
  return userId === SUPER_ADMIN_ID;
}
```

### New Features (by section):

---

### 1. Admin Authentication
- All admin commands (`/admin`, `/broadcast`, `/report`, `/add_product`, `/edit_price`, `/out_stock`) check `isAdmin(userId)`.
- Non-admins get: "Access Denied. You are not authorized."
- `/admin` shows admin control panel with inline buttons.

### 2. Order Forwarding System
- When ANY user sends a text message (non-command), photo, or document, the bot:
  1. Saves the user in `telegram_bot_users` (upsert)
  2. Forwards the message to Admin ID `6898461453`
  3. Sends admin a header: "From: @username (ID: 123456)" with action buttons:
     - [Confirm Order] -> sends customer "Payment verified. Order confirmed!"
     - [Reject/Fake] -> sends customer "Payment could not be verified."
     - [Shipped] -> sends customer "Your product has been dispatched!"
  4. Creates a `telegram_orders` record

- Callback data format: `admin_confirm_{oderId}`, `admin_reject_{orderId}`, `admin_ship_{orderId}`

### 3. Live Inventory Control (Admin-only commands)

**`/add_product`** - Multi-step flow using conversation state:
- Step 1: Bot asks "Send the product photo"
- Step 2: Bot asks "Enter product name"
- Step 3: Bot asks "Enter price"
- Step 4: Bot asks "Enter category"
- Saves to `products` table via Supabase

**`/edit_price <product_name> <new_price>`** - Updates product price directly.

**`/out_stock <product_name>`** - Sets `stock = 0` and `is_active = false`.

(Conversation state stored in a simple in-memory Map, reset on function cold start -- acceptable for single-admin use.)

### 4. Broadcast Feature
- `/broadcast` followed by text or image.
- Queries all `telegram_bot_users` where `is_banned = false`.
- Sends message to each user with error handling (skip blocked users).
- Reports back: "Broadcast sent to X users, Y failed."

### 5. User Management
- `/users` - Shows total user count and recent signups.
- `/history <telegram_id>` - Shows user's order history from `telegram_orders`.
- `/ban <telegram_id>` - Sets `is_banned = true`, bot ignores future messages.
- `/unban <telegram_id>` - Removes ban.

### 6. Sales Reports
- `/report` generates:
  - Total registered users
  - Today's orders (from `telegram_orders`)
  - Today's confirmed revenue
  - All-time stats

### 7. Ban System
- On every incoming message, check if user is banned in `telegram_bot_users`.
- If banned, silently ignore (no response).

---

## Admin Panel Update: `AdminTelegramBot.tsx`

Update the web admin panel to reflect new bot capabilities:
- Show new command list (`/admin`, `/broadcast`, `/report`, `/ban`, `/add_product`, etc.)
- Display `telegram_bot_users` count and `telegram_orders` stats
- Keep existing webhook management

---

## Message Flow Diagram

```text
User sends photo/text
       |
       v
  Check banned? --yes--> ignore
       |no
       v
  Save/update telegram_bot_users
       |
       v
  Forward to Admin (6898461453)
  + Action buttons [Confirm] [Reject] [Shipped]
  + Create telegram_orders record
       |
       v
  Admin clicks button
       |
       v
  Bot sends status message to original user
  + Updates telegram_orders status
```

## Technical Details

- **Single file**: All logic stays in `supabase/functions/telegram-bot/index.ts`
- **Conversation state**: In-memory Map for `/add_product` multi-step flow
- **Database**: 2 new tables with RLS disabled (service role access only from edge function)
- **Telegram API methods used**: `sendMessage`, `sendPhoto`, `forwardMessage`, `answerCallbackQuery`
- **No breaking changes**: Existing product browsing, buy flow, offers all preserved

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/telegram-bot/index.ts` | Major rewrite with all new handlers |
| `src/components/admin/AdminTelegramBot.tsx` | Update to show new features & stats |
| Database migration | Create `telegram_bot_users` and `telegram_orders` tables |

