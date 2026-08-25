import { supabase } from "@/lib/supabase";

/** Shape of a restaurant record (only the fields we need for bootstrap). */
export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  contact_phone: string | null;
  timezone: string;
  max_party_size: number;
  opening_hours: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Returns the restaurant that belongs to the currently‑authenticated user.
 * If no such record exists, it creates a default sandbox restaurant and returns it.
 *
 * The function is **idempotent** – calling it repeatedly (or after a page refresh)
 * will never create duplicate rows because it first queries for an existing record.
 *
 * @throws if the user is not authenticated or if a Supabase request fails.
 * @returns the restaurant record belonging to the current user.
 */
export async function getOrCreateRestaurantForCurrentUser(): Promise<Restaurant> {
  // ------- 1. Get current authenticated user -------
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(`Failed to retrieve auth user: ${userError.message}`);
  }
  if (!user) {
    throw new Error("No authenticated user – cannot fetch restaurant.");
  }

  // ------- 2. Look for an existing restaurant owned by this user -------
  const { data: existing, error: selectError } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle(); // returns null if not found, no error

  if (selectError && selectError.code !== "PGRST116") {
    // PGRST116 = “No rows found” – we ignore that because it just means there is none.
    throw new Error(`Failed to query restaurants: ${selectError.message}`);
  }

  if (existing) {
    // Restaurant already exists – return it.
    return existing as Restaurant;
  }

  // ------- 3. No restaurant – create a default sandbox one -------
  const defaultRestaurant = {
    owner_id: user.id,
    name: "TableFlow Demo Restaurant",
    contact_phone: null,
    timezone: "Asia/Kuala_Lumpur",
    max_party_size: 20,
    opening_hours: {} as Record<string, any>,
  };

  const { data: created, error: insertError } = await supabase
    .from("restaurants")
    .insert(defaultRestaurant)
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create restaurant: ${insertError.message}`);
  }

  // The newly created row is guaranteed to be the only one for this owner.
  return created as Restaurant;
}