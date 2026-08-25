-- Enable Row Level Security (RLS) on the three tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
--  PROFILES
-- ------------------------------------------------------------
-- Drop any existing policies (safe to re‑run)
DROP POLICY IF EXISTS select_profile ON public.profiles;
DROP POLICY IF EXISTS update_profile ON public.profiles;
DROP POLICY IF EXISTS insert_profile ON public.profiles;

-- SELECT: a user may read only their own profile
CREATE POLICY "select_profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- UPDATE: a user may modify only their own profile
CREATE POLICY "update_profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- INSERT: a profile can only be created for the current user
CREATE POLICY "insert_profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ------------------------------------------------------------
--  RESTAURANTS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS select_restaurants ON public.restaurants;
DROP POLICY IF EXISTS insert_restaurants ON public.restaurants;
DROP POLICY IF EXISTS update_restaurants ON public.restaurants;

-- SELECT: a user may read only restaurants they own
CREATE POLICY "select_restaurants"
ON public.restaurants
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- INSERT: a user may create a restaurant only for themselves
CREATE POLICY "insert_restaurants"
ON public.restaurants
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- UPDATE: a user may modify only their own restaurant
CREATE POLICY "update_restaurants"
ON public.restaurants
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- ------------------------------------------------------------
--  BOOKINGS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS select_bookings ON public.bookings;
DROP POLICY IF EXISTS insert_bookings ON public.bookings;
DROP POLICY IF EXISTS update_bookings ON public.bookings;

-- SELECT: a user may read a booking only if the booking’s
-- restaurant belongs to them
CREATE POLICY "select_bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = bookings.restaurant_id
      AND r.owner_id = auth.uid()
  )
);

-- INSERT: a user may insert a booking only for a restaurant
-- they own
CREATE POLICY "insert_bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = bookings.restaurant_id
      AND r.owner_id = auth.uid()
  )
);

-- UPDATE: a user may update a booking only if the existing
-- booking belongs to their restaurant, and the updated row
-- must still belong to a restaurant they own
CREATE POLICY "update_bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = bookings.restaurant_id
      AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = bookings.restaurant_id
      AND r.owner_id = auth.uid()
  )
);

-- Note: No DELETE policy is created for bookings at this stage.