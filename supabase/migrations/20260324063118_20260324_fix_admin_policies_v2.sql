/*
  # Fix Admin RLS Policies - Version 2

  Replace all broken is_admin() function calls with proper user_roles checks
*/

DROP POLICY IF EXISTS "Anyone can view settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can delete settings" ON app_settings;

CREATE POLICY "Anyone can view settings"
  ON app_settings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins manage settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  );

CREATE POLICY "Admins update settings"
  ON app_settings FOR UPDATE
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

DROP POLICY IF EXISTS "Anyone can view active banners" ON banners;
DROP POLICY IF EXISTS "Admins can manage banners" ON banners;
DROP POLICY IF EXISTS "Admins can create banners" ON banners;
DROP POLICY IF EXISTS "Admins can update banners" ON banners;
DROP POLICY IF EXISTS "Admins can delete banners" ON banners;

CREATE POLICY "Anyone view active banners"
  ON banners FOR SELECT
  TO public
  USING (
    is_active = true OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  );

CREATE POLICY "Admins create banners"
  ON banners FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  );

CREATE POLICY "Admins update banners"
  ON banners FOR UPDATE
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

CREATE POLICY "Admins delete banners"
  ON banners FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  );

DROP POLICY IF EXISTS "Anyone can view active products" ON products;
DROP POLICY IF EXISTS "Admins can manage products" ON products;
DROP POLICY IF EXISTS "Admins can create products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;

CREATE POLICY "Anyone view active products"
  ON products FOR SELECT
  TO public
  USING (
    is_active = true OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  );

CREATE POLICY "Admins create products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  );

CREATE POLICY "Admins update products"
  ON products FOR UPDATE
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

CREATE POLICY "Admins delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  );

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can create own orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

CREATE POLICY "Users view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  );

CREATE POLICY "Users create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update orders"
  ON orders FOR UPDATE
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

DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
DROP POLICY IF EXISTS "Only admins can insert categories" ON categories;
DROP POLICY IF EXISTS "Only admins can update categories" ON categories;
DROP POLICY IF EXISTS "Only admins can delete categories" ON categories;
DROP POLICY IF EXISTS "Admins create categories" ON categories;
DROP POLICY IF EXISTS "Admins update categories" ON categories;
DROP POLICY IF EXISTS "Admins delete categories" ON categories;

CREATE POLICY "Anyone view active categories"
  ON categories FOR SELECT
  TO public
  USING (
    is_active = true OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  );

CREATE POLICY "Admins insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  );

CREATE POLICY "Admins modify categories"
  ON categories FOR UPDATE
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

CREATE POLICY "Admins remove categories"
  ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'temp_admin')
    )
  );
