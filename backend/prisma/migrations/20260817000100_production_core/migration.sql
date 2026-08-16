-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'LOGIN', 'PASSWORD_RESET', 'PHONE_VERIFY');
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE "LedgerStatus" AS ENUM ('PENDING', 'POSTED', 'REVERSED', 'FAILED');
CREATE TYPE "GameOrderStatus" AS ENUM ('CREATED', 'EXECUTING', 'EXECUTE_SUCCESS', 'EXECUTE_FAIL', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "username" TEXT,
  "passwordHash" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "phoneVerifiedAt" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Profile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "bio" VARCHAR(500),
  "gender" TEXT,
  "countryCode" VARCHAR(2),
  "language" TEXT NOT NULL DEFAULT 'tr',
  "birthDate" TIMESTAMP(3),
  "vipLevel" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Device" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceKey" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "deviceName" TEXT,
  "appVersion" TEXT,
  "pushToken" TEXT,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "trusted" BOOLEAN NOT NULL DEFAULT false,
  "banned" BOOLEAN NOT NULL DEFAULT false,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OtpChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "phoneE164" TEXT NOT NULL,
  "purpose" "OtpPurpose" NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Wallet" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'COIN',
  "balance" BIGINT NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "externalRef" TEXT,
  "direction" "LedgerDirection" NOT NULL,
  "amount" BIGINT NOT NULL,
  "balanceBefore" BIGINT NOT NULL,
  "balanceAfter" BIGINT NOT NULL,
  "status" "LedgerStatus" NOT NULL DEFAULT 'POSTED',
  "source" TEXT NOT NULL,
  "metadata" JSONB,
  "reversedEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameOrder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "outOrderId" VARCHAR(64) NOT NULL,
  "sudOrderId" TEXT,
  "mgId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "command" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "status" "GameOrderStatus" NOT NULL DEFAULT 'CREATED',
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomGameSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "mgId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'SUD',
  "gameRoundId" TEXT,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "RoomGameSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "target" TEXT,
  "ipHash" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneE164_key" ON "User"("phoneE164");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
CREATE UNIQUE INDEX "Device_userId_deviceKey_key" ON "Device"("userId", "deviceKey");
CREATE INDEX "Device_deviceKey_idx" ON "Device"("deviceKey");
CREATE INDEX "Device_banned_idx" ON "Device"("banned");
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");
CREATE INDEX "Session_userId_status_idx" ON "Session"("userId", "status");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "OtpChallenge_phoneE164_purpose_createdAt_idx" ON "OtpChallenge"("phoneE164", "purpose", "createdAt");
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");
CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");
CREATE UNIQUE INDEX "LedgerEntry_reversedEntryId_key" ON "LedgerEntry"("reversedEntryId");
CREATE INDEX "LedgerEntry_userId_createdAt_idx" ON "LedgerEntry"("userId", "createdAt");
CREATE INDEX "LedgerEntry_externalRef_idx" ON "LedgerEntry"("externalRef");
CREATE INDEX "LedgerEntry_source_createdAt_idx" ON "LedgerEntry"("source", "createdAt");
CREATE UNIQUE INDEX "GameOrder_outOrderId_key" ON "GameOrder"("outOrderId");
CREATE UNIQUE INDEX "GameOrder_sudOrderId_key" ON "GameOrder"("sudOrderId");
CREATE INDEX "GameOrder_userId_createdAt_idx" ON "GameOrder"("userId", "createdAt");
CREATE INDEX "GameOrder_status_updatedAt_idx" ON "GameOrder"("status", "updatedAt");
CREATE INDEX "RoomGameSession_roomId_mgId_idx" ON "RoomGameSession"("roomId", "mgId");
CREATE INDEX "RoomGameSession_userId_joinedAt_idx" ON "RoomGameSession"("userId", "joinedAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_reversedEntryId_fkey" FOREIGN KEY ("reversedEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameOrder" ADD CONSTRAINT "GameOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomGameSession" ADD CONSTRAINT "RoomGameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
