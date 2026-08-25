-- 001_tableflow_initial_schema.sql
-- Supabase initial schema for the TableFlow AI prototype.
-- This migration is now safe to run multiple times on the same project.

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
-- Function to keep `updated_at` in sync (CREATE OR REPLACE)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Triggers – safely recreated on each run
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_profiles_update ON public.profiles;
CREATE TRIGGER trg_profiles_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_restaurants_update ON public.restaurants;
CREATE TRIGGER trg_restaurants_update
BEFORE UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_bookings_update ON public.bookings;
CREATE TRIGGER trg_bookings_update
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ------------------------------------------------------------
-- Design notes (accurate re‑run safety)
-- ------------------------------------------------------------
-- • Tables are created with IF NOT EXISTS – safe on repeated runs.
-- • Indexes use IF NOT EXISTS – idempotent.
-- • Enum types are created inside a DO block that checks pg_type – safe to run again.
-- • The update_timestamp function uses CREATE OR REPLACE – safe to run again.
-- • Each trigger is dropped first (DROP TRIGGER IF EXISTS) then recreated, making the whole migration fully idempotent.
-- • No RLS policies are added yet; the foreign‑key relationships provide a clear anchor for future row‑level security.