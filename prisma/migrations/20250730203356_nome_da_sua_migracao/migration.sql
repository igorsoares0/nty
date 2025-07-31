-- CreateTable
CREATE TABLE "ButtonSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "backgroundColor" TEXT NOT NULL DEFAULT '#000000',
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "borderRadius" INTEGER NOT NULL DEFAULT 4,
    "textSize" INTEGER NOT NULL DEFAULT 16,
    "textContent" TEXT NOT NULL DEFAULT 'Notify Me',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FormSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "formBgColor" TEXT NOT NULL DEFAULT '#ffffff',
    "buttonColor" TEXT NOT NULL DEFAULT '#000000',
    "buttonBorderRadius" INTEGER NOT NULL DEFAULT 4,
    "textSize" INTEGER NOT NULL DEFAULT 14,
    "textColor" TEXT NOT NULL DEFAULT '#333333',
    "phoneNumberEnabled" BOOLEAN NOT NULL DEFAULT false,
    "formTitle" TEXT NOT NULL DEFAULT 'Get notified when back in stock!',
    "formDescription" TEXT NOT NULL DEFAULT 'Enter your email to be notified when this item is available.',
    "buttonText" TEXT NOT NULL DEFAULT 'Subscribe',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ButtonSettings_shopId_key" ON "ButtonSettings"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "FormSettings_shopId_key" ON "FormSettings"("shopId");
