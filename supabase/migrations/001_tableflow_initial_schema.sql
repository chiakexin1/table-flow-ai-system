-- 001_tableflow_initial_schema.sql
-- Supabase initial schema for the TableFlow AI prototype.
-- This migration is intended to be executed once on a fresh Supabase project.
-- Running it multiple times will error on enum/type/trigger recreation.
-- ------------------------------------------------------------
-- 1️⃣ profiles
-- Stores a 1‑to‑1 record for each auth user.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2️⃣ restaurants
-- Each restaurant is owned by a single auth user (owner_id).
-- ------------------------------------------------------------
-- NOTE: owner_id is NOT NULL and cascades on user deletion – in this sandbox
-- prototype a restaurant is considered part of the owner’s data, so it is
-- removed together with the user.
CREATE TABLE IF NOT EXISTS public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_phone TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  max_party_size INTEGER NOT NULL CHECK (max_party_size BETWEEN 1 AND 20),
  opening_hours JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3️⃣ bookings
-- Mirrors the B2 booking model.
-- ------------------------------------------------------------
-- Enumerated types (created once; re‑running the migration will fail)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_source') THEN
    CREATE TYPE booking_source AS ENUM ('WhatsApp', 'Website', 'Phone', 'Walk-in');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM ('Pending', 'Confirmed', 'Completed', 'Cancelled', 'No-show', 'Escalated');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size BETWEEN 1 AND 20),
  special_request TEXT,
  source booking_source NOT NULL,
  status booking_status NOT NULL DEFAULT 'Pending',
  handled_by_ai BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Indexes for performant queries
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON public.restaurants (owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_id ON public.bookings (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings (booking_date);

-- ------------------------------------------------------------
-- Triggers to keep `updated_at` in sync
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- profiles
CREATE TRIGGER trg_profiles_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- restaurants
CREATE TRIGGER trg_restaurants_update
BEFORE UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- bookings
CREATE TRIGGER trg_bookings_update
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ------------------------------------------------------------
-- Design notes
-- ------------------------------------------------------------
-- • All UUID primary keys are generated server‑side (gen_random_uuid()) except
--   for profiles.id, which mirrors the auth.users.id.
-- • owner_id cascades on delete – deleting a user removes their restaurants and,
--   via cascade, their bookings.
-- • max_party_size is constrained to 1‑20, matching the client‑side validation.
-- • timezone defaults to 'Asia/Kuala_Lumpur' for this sandbox; can be edited per restaurant.
-- • Enumerated types enforce the exact allowed values for source and status.
-- • No RLS policies are added yet; the foreign‑key relationships give a clean
--   anchor (owner_id → auth.users.id) that later RLS can reference to enforce
--   row‑level isolation between different owners.
-- • The migration uses IF NOT EXISTS for tables and indexes, but enum creation
--   is guarded by a DO block because PostgreSQL does not support
--   CREATE TYPE IF NOT EXISTS.  Running the migration a second time will
--   raise an error on the enum statements, so it should be executed only once
--   on a clean project.