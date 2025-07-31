-- CreateTable
CREATE TABLE "Settings" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT 'Back in Stock Notification',
    "headline" TEXT NOT NULL DEFAULT 'Great News!',
    "bodyText" TEXT NOT NULL DEFAULT 'The item you requested is now back in stock.',
    "buttonText" TEXT NOT NULL DEFAULT 'Shop Now',
    "buttonColor" TEXT NOT NULL DEFAULT '#ffffff',
    "buttonBgColor" TEXT NOT NULL DEFAULT '#000000',
    "buttonRadius" INTEGER NOT NULL DEFAULT 4,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SmsTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT 'Great news! The item you requested is back in stock. Visit our store to get yours now!',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "showNotification" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Settings_shopId_key" ON "Settings"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_shopId_type_key" ON "EmailTemplate"("shopId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SmsTemplate_shopId_type_key" ON "SmsTemplate"("shopId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSettings_shopId_productId_key" ON "ProductSettings"("shopId", "productId");
