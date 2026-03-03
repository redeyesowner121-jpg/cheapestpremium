

## Plan: Separate Resale Bot for Secure Reseller Links

### Problem
Currently, resale links point to the main bot (`@Cheapest_Premiums_bot`). If a buyer clicks a resale link and then does `/start`, they see the full store with original prices, causing loss for resellers.

### Solution
Create a dedicated "Resale Bot" edge function that handles ONLY resale purchases. Resale links will redirect to the new bot (`8623792627:AAG6sfa0uyiu9IHOrpoEXbiIpk_7ICX80j8`) where buyers can only complete the purchase at the reseller's custom price -- no product browsing, no original prices visible.

### Changes

**1. Store the new bot token as a secret**
- Add `RESALE_BOT_TOKEN` = `8623792627:AAG6sfa0uyiu9IHOrpoEXbiIpk_7ICX80j8`

**2. Create new edge function: `supabase/functions/resale-bot/index.ts`**
- A minimal Telegram bot handler that only processes:
  - `/start buy_LINKCODE` -- looks up `telegram_resale_links`, shows product name + custom price, starts payment flow (UPI QR + link, wallet pay)
  - `/start` (no payload) -- shows a simple message: "This bot is for purchasing via resale links only. Please use a valid link."
  - Screenshot submission (conversation state `awaiting_screenshot`) -- same payment verification flow, forwards to admins on the MAIN bot
  - No `/menu`, no product browsing, no categories, no original prices
- Reuses the same DB tables (`telegram_resale_links`, `telegram_orders`, `telegram_wallets`, `telegram_conversation_state`, `telegram_bot_users`)
- Uses the same UPI payment logic (`upi://pay?pa=8900684167@ibl&pn=Asif%20Ikbal%20Rubaiul%20Islam&am=[PRICE]&cu=INR`)
- Admin actions (approve/reject/ship) still handled by main bot since `notifyAllAdmins` sends to main bot admins

**3. Update resale link generation (both places)**
- `conversation-handlers.ts` (line ~259): Change link from `https://t.me/Cheapest_Premiums_bot?start=buy_CODE` to `https://t.me/RESALE_BOT_USERNAME?start=buy_CODE`
- `src/components/product/ResellModal.tsx` (line ~51): Change web resale link to point to the new bot: `https://t.me/RESALE_BOT_USERNAME?start=buy_CODE`
- Add `RESALE_BOT_USERNAME` constant (need to know the bot's username -- will derive from the token or ask)

**4. Set webhook for the new bot**
- Create/update `supabase/functions/telegram-set-webhook/index.ts` to support setting webhook for the resale bot pointing to the `resale-bot` edge function URL

**5. Update `constants.ts`**
- Add `RESALE_BOT_USERNAME` constant

### Resale Bot Flow
```text
Buyer clicks link --> t.me/ResaleBot?start=buy_CODE
  |
  v
Bot looks up telegram_resale_links by CODE
  |
  v
Shows: Product name, custom price, UPI payment info
  |
  v
Buyer sends screenshot --> forwarded to admins (main bot)
  |
  v
Admin approves --> buyer gets access_link on resale bot
```

### Question Needed
I need the username of the new bot (the one with token `8623792627:...`) to generate the correct `t.me/` links.

