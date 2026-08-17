-- CreateTable
CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- Backfill currently active refresh tokens so existing sessions survive deploy.
INSERT INTO "RefreshToken" ("id", "sessionId", "tokenHash", "expiresAt", "createdAt")
SELECT 'rt_' || md5("id" || ':' || "refreshTokenHash"), "id", "refreshTokenHash", "expiresAt", CURRENT_TIMESTAMP
FROM "Session";

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_sessionId_consumedAt_idx" ON "RefreshToken"("sessionId", "consumedAt");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
