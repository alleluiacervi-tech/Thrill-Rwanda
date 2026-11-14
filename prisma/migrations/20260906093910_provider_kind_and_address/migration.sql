-- CreateEnum
CREATE TYPE "ProviderKind" AS ENUM ('CAR', 'HOTEL', 'TOUR');

-- DropIndex
DROP INDEX "hotels_location_trgm_idx";

-- DropIndex
DROP INDEX "hotels_name_trgm_idx";

-- DropIndex
DROP INDEX "tours_destination_trgm_idx";

-- DropIndex
DROP INDEX "tours_name_trgm_idx";

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "kind" "ProviderKind" NOT NULL DEFAULT 'TOUR';
