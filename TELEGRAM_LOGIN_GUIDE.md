# Telegram Login System Documentation

## Overview

This system allows users to seamlessly login to the website using their Telegram bot account data. When a user generates a login code from the bot, they receive links to both Bolt and Lovable websites along with a 6-character code. Using this code, they can login to either website, and all their bot data (wallet, orders, profile) automatically syncs to the website.

## How It Works

### 1. **User Initiates Login from Bot**

When a Telegram user sends `/login` command to the bot:
- Bot queries `telegram_bot_users` table to get user's username and first_name
- Generates a random 6-character code (e.g., "ABC123")
- Stores code in `telegram_login_codes` table with:
  - `telegram_id`: User's Telegram ID
  - `username`: User's Telegram username (from bot)
  - `first_name`: User's first name (from bot)
  - `code`: Generated login code
  - `used`: false (not used yet)
  - `expires_at`: 5 minutes from now
- Sends message with:
  - Login code
  - Two clickable links:
    - `https://bolt.new?telegramLogin=ABC123`
    - `https://lovable.dev?telegramLogin=ABC123`

### 2. **User Clicks Website Link**

User clicks one of the links and arrives at the website with `telegramLogin=ABC123` in URL parameter.

The frontend (`AuthPage.tsx`):
- Detects the `telegramLogin` parameter
- Automatically opens the Telegram Login Code modal
- Pre-fills the code field
- User can immediately proceed or modify the code

### 3. **Code Verification via Edge Function**

User submits the code, which triggers the `telegram-login` edge function:

**Endpoint**: `POST /functions/v1/telegram-login`

**Request Body**:
```json
{
  "code": "ABC123"
}
```

**Edge Function Logic** (`supabase/functions/telegram-login/index.ts`):
1. Validates code exists and is not expired
2. Checks if code has already been used
3. Retrieves Telegram user data from `telegram_login_codes`
4. Fetches associated wallet data from `telegram_wallets`
5. Creates or retrieves Supabase auth user with email `telegram_[ID]@bot.local`
6. Creates/updates profile in `profiles` table with:
   - `name`: User's first name from Telegram
   - `wallet_balance`: Synced from `telegram_wallets.balance`
   - `total_deposit`: Synced from `telegram_wallets.total_earned`
7. Marks code as used
8. Returns user_id, email, and name

**Response**:
```json
{
  "success": true,
  "user_id": "uuid",
  "email": "telegram_123456@bot.local",
  "name": "User First Name"
}
```

### 4. **Website Authentication**

Frontend receives successful response and:
1. Signs in user with the provided credentials
2. User is redirected to home page
3. All bot data is now accessible in website profile

## Data Sync

When user logs in via Telegram code:

| Telegram Data | Website Data | Notes |
|---|---|---|
| `telegram_bot_users.first_name` | `profiles.name` | Used as display name |
| `telegram_bot_users.username` | Stored in auth metadata | For reference |
| `telegram_wallets.balance` | `profiles.wallet_balance` | Synced during login |
| `telegram_wallets.total_earned` | `profiles.total_deposit` | Synced during login |
| `telegram_orders.*` | Available via queries | Can be retrieved when needed |

## Database Tables

### `telegram_login_codes`
```sql
- id (uuid, primary key)
- telegram_id (bigint)
- username (text, nullable)
- first_name (text, nullable)
- code (text, unique)
- used (boolean, default: false)
- expires_at (timestamp with timezone)
- created_at (timestamp with timezone)
```

### `telegram_bot_users`
```sql
- id (uuid, primary key)
- telegram_id (bigint, unique)
- username (text, nullable)
- first_name (text, nullable)
- last_name (text, nullable)
- language (text, default: 'en')
- is_banned (boolean)
- role (text, default: 'user')
- created_at (timestamp with timezone)
- last_active (timestamp with timezone)
```

### `telegram_wallets`
```sql
- id (uuid, primary key)
- telegram_id (bigint, unique)
- balance (numeric)
- total_earned (numeric)
- referral_code (text, unique, nullable)
- referred_by (text, nullable)
- created_at (timestamp with timezone)
- updated_at (timestamp with timezone)
```

## Frontend Implementation

### AuthPage Changes
1. **URL Parameter Detection**: Checks for `telegramLogin` param and auto-opens modal
2. **Code Submission**: Calls edge function with code
3. **Auth Integration**: Uses returned credentials to sign in

### Key Files Modified
- `src/pages/AuthPage.tsx`: Updated to handle telegram login flow
- `supabase/functions/telegram-bot/menu/menu-features.ts`: Updated to send links
- `supabase/functions/telegram-login/index.ts`: New edge function for verification

## Security Features

1. **Code Expiration**: Codes expire after 5 minutes
2. **One-Time Use**: Codes can only be used once (checked and marked as used)
3. **Time-based Verification**: Server validates expiration time
4. **Email Verification**: Auth users created with email format `telegram_[ID]@bot.local`
5. **Service Role Auth**: Edge function uses service role key for secure operations

## User Flow Diagram

```
Bot User sends /login
        ↓
Bot generates code & saves to DB
        ↓
Bot sends message with code + 2 links
        ↓
User clicks link (with code in URL param)
        ↓
Website detects telegramLogin param
        ↓
Modal auto-opens with pre-filled code
        ↓
User clicks Login button
        ↓
Frontend calls /telegram-login edge function
        ↓
Edge function verifies code & syncs data
        ↓
Website creates auth user & profile
        ↓
User logged in with all bot data synced
```

## Testing

### Test Telegram Login Code Generation
1. Send `/login` to bot
2. Verify code appears in message
3. Check `telegram_login_codes` table for new entry

### Test Website Login
1. Get code from bot
2. Click provided link or manually enter code
3. Verify code pre-fills automatically (if using link)
4. Submit code
5. Verify successful login
6. Check profile has name and wallet balance from bot

### Test Code Expiration
1. Generate code but wait 6+ minutes
2. Try to use code on website
3. Should see error: "Code expired"

### Test One-Time Use
1. Generate and use code successfully
2. Try to use same code again
3. Should see error: "Code already used"

## Language Support

Bot sends messages in user's language:
- Bengali (bn): Full Bangla UI
- English (en): Full English UI

## Links Format

Links are constructed as:
- `https://bolt.new?telegramLogin=[CODE]`
- `https://lovable.dev?telegramLogin=[CODE]`

These can be customized by editing `handleLoginCode` function in `menu-features.ts`.

## Troubleshooting

### Code not appearing in database
- Check bot function logs: `supabase_logs` table
- Verify `telegram_bot_users` record exists for user
- Ensure telegram_id is being captured correctly

### User data not syncing
- Verify `telegram_wallets` record exists for telegram_id
- Check edge function returns correct structure
- Verify profiles table has RLS policies that allow insert

### Link not auto-filling code
- Check URL parameter name matches `telegramLogin` (case-sensitive)
- Verify AuthPage is checking searchParams correctly
- Check browser console for any JS errors

### Auth user creation fails
- Check if email `telegram_[ID]@bot.local` already exists
- Verify Supabase auth is not rejecting the email format
- Check edge function has SERVICE_ROLE_KEY access

## Future Enhancements

1. **QR Code Login**: Generate QR codes in bot that encode the code
2. **Session Persistence**: Remember login across devices
3. **Data Sync Updates**: Auto-sync wallet changes from bot to web
4. **Profile Linking**: Allow linking existing website account to telegram
5. **Two-Factor Authentication**: Add extra security layer
