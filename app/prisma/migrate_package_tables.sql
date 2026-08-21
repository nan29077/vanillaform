-- =====================================================
-- 패키지 상품 관련 테이블 생성 스크립트
-- 2026-07-07 PITR 복원 후 누락된 테이블 추가
-- 실행: MySQL 클라이언트 또는 RDS 콘솔에서 실행
-- =====================================================

CREATE TABLE IF NOT EXISTS `package_products` (
  `id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `imageUrl` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `packagePrice` decimal(10,2) NOT NULL,
  `stock` int NOT NULL DEFAULT 0,
  `status` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `rejectReason` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `middleAdminMargin` decimal(10,2),
  `creatorId` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `creatorRole` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `package_products_creatorId_idx` (`creatorId`),
  KEY `package_products_status_idx` (`status`),
  CONSTRAINT `package_products_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `package_items` (
  `id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `packageId` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL,
  `quantity` int NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `package_items_packageId_idx` (`packageId`),
  KEY `package_items_productId_idx` (`productId`),
  CONSTRAINT `package_items_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `package_products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `package_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `package_order_items` (
  `id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `orderId` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `packageId` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `packagePrice` decimal(10,2) NOT NULL,
  `buyerName` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `buyerPhone` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `buyerAddress` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `buyerMemo` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `paymentMethod` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `paidAt` datetime(3),
  `status` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `package_order_items_packageId_idx` (`packageId`),
  KEY `package_order_items_orderId_idx` (`orderId`),
  CONSTRAINT `package_order_items_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `package_products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `package_purchase_orders` (
  `id` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `packageOrderItemId` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipientId` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipientType` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `productId` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `productName` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `amount` decimal(10,2) NOT NULL,
  `status` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `package_purchase_orders_packageOrderItemId_idx` (`packageOrderItemId`),
  KEY `package_purchase_orders_recipientId_idx` (`recipientId`),
  CONSTRAINT `package_purchase_orders_packageOrderItemId_fkey` FOREIGN KEY (`packageOrderItemId`) REFERENCES `package_order_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `package_purchase_orders_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
