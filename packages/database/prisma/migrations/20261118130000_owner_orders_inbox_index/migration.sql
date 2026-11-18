CREATE INDEX "storefront_orders_merchantId_createdAt_id_idx"
  ON "storefront_orders"("merchantId", "createdAt", "id");
