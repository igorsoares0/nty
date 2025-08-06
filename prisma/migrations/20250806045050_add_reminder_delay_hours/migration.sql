-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "ownerEmail" TEXT,
    "autoNotificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "firstEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "firstSmsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "thankYouEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "thankYouSmsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderSmsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderDelayHours" INTEGER NOT NULL DEFAULT 24,
    "reminderMaxCount" INTEGER NOT NULL DEFAULT 2,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("autoNotificationEnabled", "createdAt", "firstEmailEnabled", "firstSmsEnabled", "id", "ownerEmail", "reminderEmailEnabled", "reminderSmsEnabled", "shopId", "thankYouEmailEnabled", "thankYouSmsEnabled", "updatedAt") SELECT "autoNotificationEnabled", "createdAt", "firstEmailEnabled", "firstSmsEnabled", "id", "ownerEmail", "reminderEmailEnabled", "reminderSmsEnabled", "shopId", "thankYouEmailEnabled", "thankYouSmsEnabled", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_shopId_key" ON "Settings"("shopId");
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT,
    "productUrl" TEXT,
    "shopId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "subscribedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" DATETIME,
    "reactivatedAt" DATETIME,
    "reactivationCount" INTEGER NOT NULL DEFAULT 0,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" DATETIME,
    "purchaseDetectedAt" DATETIME,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "source" TEXT NOT NULL DEFAULT 'widget',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Subscription" ("createdAt", "email", "id", "ipAddress", "notifiedAt", "phone", "productId", "productTitle", "productUrl", "reactivatedAt", "reactivationCount", "shopId", "source", "status", "subscribedAt", "updatedAt", "userAgent") SELECT "createdAt", "email", "id", "ipAddress", "notifiedAt", "phone", "productId", "productTitle", "productUrl", "reactivatedAt", "reactivationCount", "shopId", "source", "status", "subscribedAt", "updatedAt", "userAgent" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE UNIQUE INDEX "Subscription_email_productId_shopId_key" ON "Subscription"("email", "productId", "shopId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
