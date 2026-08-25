"use client";

import * as React from "react";
import { Booking, BookingStatus } from "@/types/booking";
import { supabase } from "@/lib/supabase";
import { getOrCreateRestaurantForCurrentUser } from "@/services/restaurantService";

/** Key used for persisting bookings in localStorage (kept for future use) */
const STORAGE_KEY = "tableflow_bookings";

/** Helper – generate a simple pseudo‑unique id (good enough for prototype) */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/** Load bookings from localStorage – *fallback only*, not used for the main list */
function loadFromStorage(): Booking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Booking[]) : [];
  } catch {
    return [];
  }
}

/** Persist bookings to localStorage – kept for future write‑side migration */
function saveToStorage(bookings: Booking[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  } catch {
    // ignore
  }
}

/** Context value shape */
export interface BookingContextValue {
  /** All bookings currently stored (now from Supabase) */
  bookings: Booking[];
  /** Loading flag for the Supabase fetch */
  loading: boolean;
  /** Optional error string from the fetch */
  error?: string;
  /** Create a new booking (still client‑side only) */
  createBooking: (
    data: Omit<Booking, "id" | "createdAt" | "updatedAt">,
  ) => Booking;
  /** Retrieve the full list (alias for `bookings`) */
  listBookings: () => Booking[];
  /** Get a single booking by its id */
  getBooking: (id: string) => Booking | undefined;
  /** Update only the status (and updatedAt) of a given booking */
  updateBookingStatus: (id: string, status: BookingStatus) => void;
}

/** Create the React context */
const BookingContext = React.createContext<BookingContextValue | undefined>(undefined);

/** Provider component – wraps the app */
export const BookingProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [bookings, setBookings] = React.useState<Booking[]>(() => loadFromStorage());
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | undefined>(undefined);

  /** -----------------------------------------------------------------
   *  1️⃣  Fetch bookings from Supabase once we know the authenticated user
   *      and have resolved his/her restaurant.
   * ----------------------------------------------------------------- */
  React.useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setError(undefined);
      try {
        // 1️⃣ Get the restaurant belonging to the current user
        const restaurant = await getOrCreateRestaurantForCurrentUser();

        // 2️⃣ Query bookings for that restaurant
        const { data, error: supabaseError } = await supabase
          .from("bookings")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("booking_date", { ascending: true })
          .order("booking_time", { ascending: true });

        if (supabaseError) {
          throw supabaseError;
        }

        // 3️⃣ Map snake_case DB rows → camelCase frontend Booking objects
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
        // keep a copy in localStorage for now (optional)
        saveToStorage(mapped);
      } catch (err: any) {
        console.error("[BookingProvider] failed to load bookings:", err);
        setError(err?.message ?? "Failed to load bookings.");
      } finally {
        setLoading(false);
      }
    };

    fetch();
    // Run only once on mount – restaurant helper internally ensures idempotency
  }, []); // empty deps: runs after component mounts

  /** -----------------------------------------------------------------
   *  2️⃣  Existing client‑side create / update helpers (still local only)
   * ----------------------------------------------------------------- */
  const createBooking = React.useCallback(
    (data) => {
      const now = new Date().toISOString();
      const newBooking: Booking = {
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        handledByAI: false,
        ...data,
      };
      setBookings((prev) => [newBooking, ...prev]);
      saveToStorage([newBooking, ...bookings]); // keep local copy
      return newBooking;
    },
    [bookings],
  );

  const listBookings = React.useCallback(() => bookings, [bookings]);

  const getBooking = React.useCallback(
    (id: string) => bookings.find((b) => b.id === id),
    [bookings],
  );

  const updateBookingStatus = React.useCallback(
    (id: string, status: BookingStatus) => {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id ? { ...b, status, updatedAt: new Date().toISOString() } : b,
        ),
      );
    },
    [],
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