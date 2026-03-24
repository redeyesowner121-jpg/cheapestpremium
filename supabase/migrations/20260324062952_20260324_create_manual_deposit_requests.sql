/*
  # Create manual_deposit_requests table

  1. New Tables
    - `manual_deposit_requests` - For tracking manual wallet deposits/topups

  2. Security
    - Enable RLS
    - Users can view and create their own requests
    - Admins can view and update all requests
*/

CREATE TABLE IF NOT EXISTS manual_deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text DEFAULT 'INR',
  payment_method text,
  screenshot_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE manual_deposit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deposit requests"
  ON manual_deposit_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create deposit requests"
  ON manual_deposit_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all deposit requests"
  ON manual_deposit_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  );

CREATE POLICY "Admins can update deposit requests"
  ON manual_deposit_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  );

CREATE INDEX idx_manual_deposits_user_id ON manual_deposit_requests(user_id);
CREATE INDEX idx_manual_deposits_status ON manual_deposit_requests(status);
CREATE INDEX idx_manual_deposits_created_at ON manual_deposit_requests(created_at DESC);
