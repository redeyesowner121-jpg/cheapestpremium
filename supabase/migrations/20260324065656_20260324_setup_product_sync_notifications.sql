/*
  # Setup Product Sync Notifications

  This creates a system to automatically sync products between website and bot.
  - product_sync_queue table stores all product changes
  - Triggers automatically queue events when products are modified
  - Bot can poll queue to get latest products
*/

CREATE TABLE IF NOT EXISTS product_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for sync queue"
  ON product_sync_queue FOR SELECT
  USING (true);

CREATE POLICY "Allow insert to sync queue"
  ON product_sync_queue FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update to sync queue"
  ON product_sync_queue FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_product_sync_queue_processed ON product_sync_queue(processed);
CREATE INDEX IF NOT EXISTS idx_product_sync_queue_created_at ON product_sync_queue(created_at);

CREATE OR REPLACE FUNCTION queue_product_sync_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO product_sync_queue (event_type, product_id)
  VALUES ('product_create', NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION queue_product_sync_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.* IS DISTINCT FROM NEW.* THEN
    INSERT INTO product_sync_queue (event_type, product_id)
    VALUES ('product_update', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_product_insert ON products;
DROP TRIGGER IF EXISTS trigger_product_update ON products;

CREATE TRIGGER trigger_product_insert
AFTER INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION queue_product_sync_on_insert();

CREATE TRIGGER trigger_product_update
AFTER UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION queue_product_sync_on_update();
