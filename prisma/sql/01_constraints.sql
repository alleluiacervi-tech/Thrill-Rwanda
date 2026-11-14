-- Run this AFTER the first `npm run db:migrate`.
--
-- Prisma's schema language cannot express CHECK constraints, but these are
-- exactly the guarantees that keep the booking engine correct. Apply them
-- with:
--
--   psql "$DIRECT_URL" -f prisma/sql/01_constraints.sql
--
-- or paste into the Neon SQL editor. To keep them in the migration history,
-- copy this file's contents into the bottom of the newest generated
-- migration.sql before applying it.

-- ---------------------------------------------------------------------------
-- The constraint that makes overbooking impossible.
--
-- Application-level "check availability, then insert" is a race: two
-- concurrent requests both read units_booked = units_total - 1, both pass the
-- check, and both insert. Postgres rejecting the second UPDATE is the only
-- reliable guard.
--
-- Booking flow must therefore be, inside ONE transaction:
--   1. UPDATE availability SET units_booked = units_booked + $units
--        WHERE service_type = $t AND resource_id = $r
--          AND day >= $start AND day < $end AND is_blocked = false;
--   2. verify the UPDATE touched exactly (end - start) rows;
--   3. INSERT the booking row.
-- If the CHECK fires, the transaction rolls back and the customer sees
-- "no longer available" instead of a double-booked room.
-- ---------------------------------------------------------------------------
ALTER TABLE availability
  ADD CONSTRAINT availability_not_overbooked
  CHECK (units_booked >= 0 AND units_booked <= units_total);

-- Ratings are 1–5, enforced by the database rather than by trusting a client.
ALTER TABLE reviews
  ADD CONSTRAINT reviews_rating_range
  CHECK (rating >= 1 AND rating <= 5);

-- A booking must cover at least one day.
ALTER TABLE bookings
  ADD CONSTRAINT bookings_date_order
  CHECK (end_date > start_date);

-- Money is never negative.
ALTER TABLE bookings
  ADD CONSTRAINT bookings_total_non_negative
  CHECK (total_minor >= 0 AND subtotal_minor >= 0);

ALTER TABLE payments
  ADD CONSTRAINT payments_amount_positive
  CHECK (amount_minor > 0);

-- ---------------------------------------------------------------------------
-- Step 17 search. Trigram indexes make fuzzy name/location matching fast
-- enough that this catalogue never needs a separate search service.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS tours_name_trgm_idx
  ON tours USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tours_destination_trgm_idx
  ON tours USING gin (destination gin_trgm_ops);
CREATE INDEX IF NOT EXISTS hotels_name_trgm_idx
  ON hotels USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS hotels_location_trgm_idx
  ON hotels USING gin (location gin_trgm_ops);
