-- Car hire: an optional driver, and the damage liability the customer accepts.
ALTER TABLE "vehicles" ADD COLUMN "driver_per_day_minor" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN "insurance_charge_minor" INTEGER;

-- The wording the admin can edit. {amount} is filled in per vehicle at checkout.
ALTER TABLE "site_settings" ADD COLUMN "damage_liability_text" TEXT NOT NULL
  DEFAULT 'I agree that in the event of damage to the hired vehicle, I will be liable for the applicable amount of {amount}, as specified for this vehicle.';
