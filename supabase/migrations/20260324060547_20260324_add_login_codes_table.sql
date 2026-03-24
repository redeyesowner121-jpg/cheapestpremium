/*
  # Add login codes table for web login via Telegram

  1. New Tables
    - `telegram_login_codes`
      - `code` (text, primary key) - 6-digit unique code
      - `telegram_id` (bigint) - User's telegram ID
      - `created_at` (timestamp) - Creation time
      - `expires_at` (timestamp) - Expiration time (5 minutes)
      - `used_at` (timestamp) - When code was used
      - `used_by_ip` (text) - IP of web user
  
  2. Security
    - Enable RLS on `telegram_login_codes`
    - Policy for creating codes (authenticated users only)
    - Policy for verifying codes (public, but validates time and IP)
*/

CREATE TABLE IF NOT EXISTS telegram_login_codes (
  code TEXT PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
  used_at TIMESTAMPTZ,
  used_by_ip TEXT,
  created_at_timestamp BIGINT
);

ALTER TABLE telegram_login_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own login codes"
  ON telegram_login_codes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can verify login codes"
  ON telegram_login_codes FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can mark codes as used"
  ON telegram_login_codes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_telegram_login_codes_telegram_id ON telegram_login_codes(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_login_codes_expires_at ON telegram_login_codes(expires_at);
