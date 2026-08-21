SELECT TABLE_NAME, CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'vanillaform'
  AND TABLE_NAME IN (
    'package_products',
    'package_items',
    'package_order_items',
    'package_purchase_orders'
  )
ORDER BY TABLE_NAME;
