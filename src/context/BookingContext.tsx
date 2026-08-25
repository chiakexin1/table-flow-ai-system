"use client";

import * as React from "react";
import { Booking, BookingStatus } from "@/types/booking";
import { supabase } from "@/lib/supabase";
import { getOrCreateRestaurantForCurrentUser } from "@/services/restaurantService";
import { useAuth } from "@/context/AuthContext";

/** --------------------------------------------------------------
 *  BookingContext – Supabase is now the *only* source of truth.
 *  The provider reacts to authentication changes so that bookings
 *  from a previous user are never shown after logout/login.
 * -------------------------------------------------------------- */

export interface BookingContextValue {
  /** All bookings currently stored (loaded from Supabase) */
  bookings: Booking[];
  /** Loading flag for the Supabase fetch */
  loading: boolean;
  /** Optional error string from the fetch */
  error?: string;
  /** Create a new booking (stored in Supabase) */
  createBooking: (
    data: Omit<Booking, "id" | "createdAt" | "updatedAt" | "restaurantId">,
  ) => Promise<Booking>;
  /** Retrieve the full list (alias for `bookings`) */
  listBookings: () => Booking[];
  /** Get a single booking by its id */
  getBooking: (id: string) => Booking | undefined;
  /** Update only the status (and updatedAt) of a given booking */
  updateBookingStatus: (id: string, status: BookingStatus) => Promise<void>;
}

/** Create the React context */
const BookingContext = React.createContext<BookingContextValue | undefined>(undefined);

/** Provider component – wraps the app */
export const BookingProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // -----------------------------------------------------------------
  // 1️⃣  STATE – start empty; we will fetch only when we have a user.
  // -----------------------------------------------------------------
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>(undefined);

  // -----------------------------------------------------------------
  // 2️⃣  Auth – pull the current user from AuthContext.
  // -----------------------------------------------------------------
  const { user } = useAuth();

  /** --------------------------------------------------------------
   *  3️⃣  Whenever the authenticated user changes (login, logout,
   *      or switch), we either fetch the correct bookings or clear
   *      the stale state.
   * -------------------------------------------------------------- */
  React.useEffect(() => {
    // ── No user → clear everything (logout or not yet logged in)
    if (!user) {
      setBookings([]);
      setLoading(false);
      setError(undefined);
      return;
    }

    // ── Authenticated → fetch bookings for *this* user's restaurant
    const fetch = async () => {
      setLoading(true);
      setError(undefined);
      try {
        // 1️⃣ Resolve the restaurant that belongs to the current user
        const restaurant = await getOrCreateRestaurantForCurrentUser(); // uses the current auth user internally

        // 2️⃣ Fetch ONLY the bookings that belong to that restaurant
        const { data, error: supabaseError } = await supabase
          .from("bookings")
          .select("*")
          .eq("restaurant_id", restaurant.id) // <-- strict filtering
          .order("booking_date", { ascending: true })
          .order("booking_time", { ascending: true });

        if (supabaseError) {
          throw supabaseError;
        }

        // 3️⃣ Map DB rows → frontend camelCase objects
        const mapped: Booking[] = (data ?? []).map((row: any) => ({
          id: row.id,
          restaurantId: row.restaurant_id,
          customerName: row.customer_name,
          phone: row.phone,
          bookingDate: row.booking_date,
          bookingTime: row.booking_time,
          partySize: row.party_size,
          specialRequest: row.special_request ?? undefined,
          source: row.source,
          status: row.status,
          handledByAI: row.handled_by_ai,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));

        setBookings(mapped);
      } catch (err: any) {
        console.error("[BookingProvider] failed to load bookings:", err);
        setError(err?.message ?? "Failed to load bookings.");
        setBookings([]); // ensure no stale data leaks
      } finally {
        setLoading(false);
      }
    };

    fetch();
    // Re‑run whenever the auth user changes
  }, [user]); // <-- dependency on the authenticated user

  /** --------------------------------------------------------------
   *  4️⃣  CREATE – insert a new booking into Supabase (restaurant_id
   *      comes from the *current* user's restaurant)
   * -------------------------------------------------------------- */
  const createBooking = React.useCallback(
    async (data) => {
      try {
        const restaurant = await getOrCreateRestaurantForCurrentUser();

        const { data: inserted, error: insertError } = await supabase
          .from("bookings")
          .insert({
            restaurant_id: restaurant.id,
            customer_name: data.customerName,
            phone: data.phone,
            booking_date: data.bookingDate,
            booking_time: data.bookingTime,
            party_size: data.partySize,
            special_request: data.specialRequest ?? null,
            source: data.source,
            status: "Pending",
            handled_by_ai: data.handledByAI ?? false,
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        const newBooking: Booking = {
          id: inserted.id,
          restaurantId: inserted.restaurant_id,
          customerName: inserted.customer_name,
          phone: inserted.phone,
          bookingDate: inserted.booking_date,
          bookingTime: inserted.booking_time,
          partySize: inserted.party_size,
          specialRequest: inserted.special_request ?? undefined,
          source: inserted.source,
          status: inserted.status,
          handledByAI: inserted.handled_by_ai,
          createdAt: inserted.created_at,
          updatedAt: inserted.updated_at,
        };

        // Optimistically prepend to UI state
        setBookings((prev) => [newBooking, ...prev]);

        return newBooking;
      } catch (err: any) {
        console.error("[BookingProvider] createBooking error:", err);
        throw err;
      }
    },
    [],
  );

  /** --------------------------------------------------------------
   *  5️⃣  UPDATE – change booking status in Supabase (optimistic UI)
   * -------------------------------------------------------------- */
  const updateBookingStatus = React.useCallback(
    async (id: string, status: BookingStatus) => {
      const previous = bookings.find((b) => b.id === id);
      if (!previous) {
        throw new Error("Booking not found in local state.");
      }

      // Optimistic UI update
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id ? { ...b, status, updatedAt: new Date().toISOString() } : b,
        ),
      );

      const { error: supabaseError } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", id);

      if (supabaseError) {
        // Revert UI on failure
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...previous } : b)),
        );
        console.error("[BookingProvider] status update failed:", supabaseError);
        throw supabaseError;
      }
      // Success – optimistic state stays.
    },
    [bookings],
  );

  const listBookings = React.useCallback(() => bookings, [bookings]);

  const getBooking = React.useCallback(
    (id: string) => bookings.find((b) => b.id === id),
    [bookings],
  );

  const value: BookingContextValue = {
    bookings,
    loading,
    error,
    createBooking,
    listBookings,
    getBooking,
    updateBookingStatus,
  };

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
};

/** Hook for easy consumption */
export const useBooking = (): BookingContextValue => {
  const ctx = React.useContext(BookingContext);
  if (!ctx) {
    throw new Error("useBooking must be used within a BookingProvider");
  }
  return ctx;
};