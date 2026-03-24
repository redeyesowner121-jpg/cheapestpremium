/*
  # Setup Product & Category Sync Webhooks

  1. Creates triggers on products and categories tables
  2. When products/categories are updated, creates notifications for sync
  3. These notifications can be consumed by the bot/frontend

  Changes:
  - Add products_sync_log table to track changes
  - Add categories_sync_log table to track changes
  - Create triggers on products table for INSERT/UPDATE/DELETE
  - Create triggers on categories table for INSERT/UPDATE/DELETE
*/

CREATE TABLE IF NOT EXISTS products_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  action text NOT NULL,
  changed_at timestamptz DEFAULT now(),
  data jsonb
);

CREATE INDEX IF NOT EXISTS idx_products_sync_log_created ON products_sync_log(changed_at DESC);

CREATE TABLE IF NOT EXISTS categories_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  action text NOT NULL,
  changed_at timestamptz DEFAULT now(),
  data jsonb
);

CREATE INDEX IF NOT EXISTS idx_categories_sync_log_created ON categories_sync_log(changed_at DESC);

CREATE OR REPLACE FUNCTION log_product_sync() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO products_sync_log (product_id, action, data)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    jsonb_build_object(
      'name', COALESCE(NEW.name, OLD.name),
      'category', COALESCE(NEW.category, OLD.category),
      'is_active', COALESCE(NEW.is_active, OLD.is_active),
      'price', COALESCE(NEW.price, OLD.price)
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_category_sync() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO categories_sync_log (category_id, action, data)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    jsonb_build_object(
      'name', COALESCE(NEW.name, OLD.name),
      'slug', COALESCE(NEW.slug, OLD.slug),
      'is_active', COALESCE(NEW.is_active, OLD.is_active)
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_sync ON products;
CREATE TRIGGER trg_products_sync
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW
EXECUTE FUNCTION log_product_sync();

DROP TRIGGER IF EXISTS trg_categories_sync ON categories;
CREATE TRIGGER trg_categories_sync
AFTER INSERT OR UPDATE OR DELETE ON categories
FOR EACH ROW
EXECUTE FUNCTION log_category_sync();
