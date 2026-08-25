"use client";

import * as React from "react";
import { Booking, BookingStatus } from "@/types/booking";

/** Key used for persisting bookings in localStorage */
const STORAGE_KEY = "tableflow_bookings";

/** Helper – generate a simple pseudo‑unique id (good enough for prototype) */
function generateId(): string {
  // Combine timestamp with a random suffix
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/** Load bookings from localStorage (if any) */
function loadFromStorage(): Booking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Booking[]) : [];
  } catch {
    // Corrupted data – start fresh
    return [];
  }
}

/** Persist bookings to localStorage */
function saveToStorage(bookings: Booking[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  } catch {
    // Silently ignore storage errors in the prototype
  }
}

/** Context value shape */
export interface BookingContextValue {
  /** All bookings currently stored */
  bookings: Booking[];

  /** Create a new booking (client‑side only) */
  createBooking: (data: Omit<Booking, "id" | "createdAt" | "updatedAt">) => Booking;

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

  /** Keep localStorage in sync whenever bookings change */
  React.useEffect(() => {
    saveToStorage(bookings);
  }, [bookings]);

  /** Create a new booking – fills id, timestamps, default flags */
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
      return newBooking;
    },
    [],
  );

  /** List all bookings (just returns the current array) */
  const listBookings = React.useCallback(() => bookings, [bookings]);

  /** Find a booking by id */
  const getBooking = React.useCallback(
    (id: string) => bookings.find((b) => b.id === id),
    [bookings],
  );

  /** Update only the status of a booking */
  const updateBookingStatus = React.useCallback(
    (id: string, status: BookingStatus) => {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, status, updatedAt: new Date().toISOString() }
            : b,
        ),
      );
    },
    [],
  );

  const value: BookingContextValue = {
    bookings,
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