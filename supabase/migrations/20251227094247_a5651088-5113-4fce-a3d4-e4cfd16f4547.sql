-- Add settings for low stock threshold
INSERT INTO app_settings (key, value) VALUES ('low_stock_threshold', '5') ON CONFLICT DO NOTHING;

-- Add platform_commission setting (10%)
INSERT INTO app_settings (key, value) VALUES ('platform_commission', '10') ON CONFLICT DO NOTHING;