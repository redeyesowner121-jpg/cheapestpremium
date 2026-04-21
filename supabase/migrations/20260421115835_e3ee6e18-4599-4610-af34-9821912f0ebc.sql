-- Move product-level stock items to the single variation for products with exactly 1 variation
UPDATE product_stock_items psi
SET variation_id = sq.variation_id
FROM (
  SELECT pv.product_id, pv.id AS variation_id
  FROM product_variations pv
  WHERE pv.product_id IN (
    SELECT product_id FROM product_variations GROUP BY product_id HAVING count(*) = 1
  )
) sq
WHERE psi.product_id = sq.product_id
  AND psi.variation_id IS NULL;

-- Also update the variation delivery_mode to 'unique' if stock items were moved
UPDATE product_variations pv
SET delivery_mode = 'unique'
WHERE pv.id IN (
  SELECT DISTINCT variation_id FROM product_stock_items WHERE variation_id IS NOT NULL AND is_used = false
)
AND pv.delivery_mode = 'repeated'
AND pv.product_id IN (
  SELECT product_id FROM product_variations GROUP BY product_id HAVING count(*) = 1
);