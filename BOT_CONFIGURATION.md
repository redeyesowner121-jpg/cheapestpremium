# Telegram Bot Configuration

## Bot Credentials

### Main Bot - @Air1_Premium_bot
**Token:** `8488230965:AAGsdfO6jrh100wfNew4tDF5q-22mLzYEBg`
**Username:** `Air1_Premium_bot`
**Purpose:** Full-featured store bot with product browsing, ordering, wallet management, and referral system

### Resale Bot - @AIR1XOTT_bot
**Token:** `8378676863:AAHGl3W2PLcvG_B9J2KehPVZoqYwszYcABM`
**Username:** `AIR1XOTT_bot`
**Purpose:** Dedicated bot for handling resale link purchases

## Updated Files

All references to bot usernames have been updated across the codebase:

### Backend (Edge Functions)

1. **telegram-bot/constants.ts**
   - `BOT_USERNAME = "Air1_Premium_bot"`
   - `RESALE_BOT_USERNAME = "AIR1XOTT_bot"`

2. **resale-bot/index.ts**
   - `MAIN_BOT_USERNAME = "Air1_Premium_bot"`
   - `RESALE_BOT_USERNAME = "AIR1XOTT_bot"`

3. **third-bot/index.ts**
   - `MAIN_BOT_USERNAME = "Air1_Premium_bot"`
   - `RESALE_BOT_USERNAME = "AIR1XOTT_bot"`

4. **telegram-set-webhook/index.ts**
   - `MAIN_BOT_USERNAME = "Air1_Premium_bot"`
   - `RESALE_BOT_USERNAME = "AIR1XOTT_bot"`

### Frontend

1. **src/components/product/ResellModal.tsx**
   - Resale link URL: `https://t.me/AIR1XOTT_bot?start=buy_{linkCode}`

2. **src/components/profile/ReferralSection.tsx**
   - Referral link URL: `{app_url}/auth?ref={referralCode}`
   - (No bot username in referral links - uses web app URL)

## Link Generation

### Referral Links (Web App)

**Format:** `https://cheapest-premiums.lovable.app/auth?ref={referralCode}`

**Example:** `https://cheapest-premiums.lovable.app/auth?ref=RKRABC123`

**How it works:**
1. User customizes their referral code (default: `RKR<6_HEX>`)
2. System generates shareable link with URL-encoded referral code
3. New users click link and register with referral code pre-filled
4. Referrer earns ₹10 bonus when referred user makes first deposit

### Resale Links (Telegram Bot)

**Format:** `https://t.me/AIR1XOTT_bot?start=buy_{linkCode}`

**Example:** `https://t.me/AIR1XOTT_bot?start=buy_ABC12345`

**How it works:**
1. Reseller creates custom price link from web app or main bot
2. System generates unique link code and stores in database
3. Customer clicks resale link → Opens @AIR1XOTT_bot
4. Bot retrieves product/price from database using link code
5. Customer completes purchase at reseller's custom price
6. Reseller earns profit (custom price - reseller price)

## Deployment Status

All edge functions have been deployed with updated bot usernames:

✅ **telegram-bot** - Main bot handler
✅ **resale-bot** - Resale purchases handler
✅ **third-bot** - Third party bot integration
✅ **telegram-set-webhook** - Webhook configuration

## Testing Checklist

### Referral Links Testing

- [ ] Generate referral link from profile page
- [ ] Copy and share referral link
- [ ] Open link in new browser/incognito
- [ ] Verify referral code is pre-filled in signup form
- [ ] Complete registration with referral code
- [ ] Verify `referred_by` field is set in database
- [ ] Verify referrer receives bonus on first deposit

### Resale Links Testing

- [ ] Create resale link from product page (must be reseller)
- [ ] Verify link format: `https://t.me/AIR1XOTT_bot?start=buy_<code>`
- [ ] Click resale link in Telegram
- [ ] Verify @AIR1XOTT_bot opens with product details
- [ ] Complete purchase through resale bot
- [ ] Verify reseller receives profit credit
- [ ] Check order shows reseller info in database

### Main Bot Testing

- [ ] Send `/start` to @Air1_Premium_bot
- [ ] Browse products
- [ ] Create order through main bot
- [ ] Verify UPI payment flow works
- [ ] Test wallet payment option
- [ ] Verify order delivery

## Environment Variables

These tokens should be configured as Supabase Edge Function secrets:

```bash
TELEGRAM_BOT_TOKEN=8488230965:AAGsdfO6jrh100wfNew4tDF5q-22mLzYEBg
RESALE_BOT_TOKEN=8378676863:AAHGl3W2PLcvG_B9J2KehPVZoqYwszYcABM
```

**Note:** Secrets are automatically configured in Supabase. No manual configuration needed.

## Webhook Setup

To set up webhooks for the bots, call the `telegram-set-webhook` edge function:

```bash
POST https://your-project.supabase.co/functions/v1/telegram-set-webhook
```

This will configure webhooks for both:
- Main bot (@Air1_Premium_bot)
- Resale bot (@AIR1XOTT_bot)

## Important Notes

1. **URL Encoding:** All link codes and referral codes are properly URL-encoded using `encodeURIComponent()`

2. **Bot Username Consistency:** Both frontend and backend now use the same bot usernames

3. **Database Tables:**
   - `profiles.referral_code` - Stores user referral codes
   - `profiles.referred_by` - Stores referrer's code
   - `resale_links` - Web-generated resale links
   - `telegram_resale_links` - Bot-generated resale links

4. **Link Code Format:**
   - Web: `Math.random().toString(36).substring(2, 10).toUpperCase()`
   - Telegram: `Date.now().toString(36) + Math.random().toString(36).substring(2, 8)`

5. **Security:** All resale links are unique and stored in database. Invalid or expired links show error messages.

## Support

If users encounter issues:
- Verify bot usernames are correct (@Air1_Premium_bot and @AIR1XOTT_bot)
- Check that webhooks are properly configured
- Verify environment variables are set
- Test link generation and redemption flow
- Check database tables for stored links

## Summary

All bot configurations have been updated to use:
- **Main Bot:** @Air1_Premium_bot
- **Resale Bot:** @AIR1XOTT_bot

Both referral links and resale links now generate correctly with proper URL encoding and correct bot usernames.
