-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('yes', 'no');

-- CreateEnum
CREATE TYPE "CharityStatus" AS ENUM ('in_review', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "User" (
    "wallet" TEXT NOT NULL,
    "limit" INTEGER NOT NULL DEFAULT 0,
    "totalDonated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "initiativesCreated" INTEGER NOT NULL DEFAULT 0,
    "initiativesSupported" INTEGER NOT NULL DEFAULT 0,
    "votesParticipated" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("wallet")
);

-- CreateTable
CREATE TABLE "Charity" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "donation_needed" DOUBLE PRECISION NOT NULL,
    "donation_collected" INTEGER NOT NULL DEFAULT 0,
    "donators_count" INTEGER NOT NULL DEFAULT 0,
    "images" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "address" TEXT,
    "status" "CharityStatus" NOT NULL DEFAULT 'in_review',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejectedDate" TIMESTAMP(3),
    "authorWallet" TEXT NOT NULL,
    "votes_yes" INTEGER NOT NULL DEFAULT 0,
    "votes_no" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Charity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "charityId" INTEGER NOT NULL,
    "userWallet" TEXT NOT NULL,
    "choice" "VoteChoice" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("charityId","userWallet")
);

-- CreateTable
CREATE TABLE "DonationHistory" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "comment" TEXT,
    "crypto_type" TEXT NOT NULL,
    "donation_amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userWallet" TEXT NOT NULL,
    "charityId" INTEGER NOT NULL,

    CONSTRAINT "DonationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NftItems" (
    "index" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_checked" BOOLEAN NOT NULL DEFAULT false,
    "sender" TEXT,

    CONSTRAINT "NftItems_pkey" PRIMARY KEY ("index")
);

-- CreateIndex
CREATE INDEX "Vote_userWallet_idx" ON "Vote"("userWallet");

-- CreateIndex
CREATE INDEX "Vote_charityId_choice_idx" ON "Vote"("charityId", "choice");

-- CreateIndex
CREATE UNIQUE INDEX "NftItems_address_key" ON "NftItems"("address");

-- AddForeignKey
ALTER TABLE "Charity" ADD CONSTRAINT "Charity_authorWallet_fkey" FOREIGN KEY ("authorWallet") REFERENCES "User"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_charityId_fkey" FOREIGN KEY ("charityId") REFERENCES "Charity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userWallet_fkey" FOREIGN KEY ("userWallet") REFERENCES "User"("wallet") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationHistory" ADD CONSTRAINT "DonationHistory_userWallet_fkey" FOREIGN KEY ("userWallet") REFERENCES "User"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationHistory" ADD CONSTRAINT "DonationHistory_charityId_fkey" FOREIGN KEY ("charityId") REFERENCES "Charity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
