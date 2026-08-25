"use client";

import { Booking, BookingStatus } from "@/types/booking";
import { Restaurant } from "@/services/restaurantService";

/* ------------------------------------------------------------------
   Types describing the AI Advisor context.
   ------------------------------------------------------------------ */
export interface AIAdvisorRestaurantInfo {
  /** Restaurant display name */
  name: string;
  /** Timezone identifier (e.g. “Asia/Kuala_Lumpur”) */
  timezone: string;
  /** Maximum party size allowed by the restaurant (optional) */
  maxPartySize?: number;
}

export interface AIAdvisorSummary {
  /** Total number of bookings currently loaded */
  totalBookings: number;
  /** Number of bookings for the current calendar day */
  todayBookings: number;
  /** Number of bookings scheduled for any future date (including today?) */
  upcomingBookings: number;
  /** Count of bookings per status value */
  statusCounts: Record<BookingStatus, number>;
  /** How many bookings have already been handled by the AI */
  aiHandledCount: number;
  /** No‑show rate as a whole‑number percentage (0‑100) */
  noShowRate: number;
}

/** Minimal representation of upcoming bookings – no sensitive fields. */
export interface AIAdvisorUpcomingBooking {
  bookingDate: string; // YYYY‑MM‑DD
  bookingTime: string; // HH:mm
  partySize: number;
  status: BookingStatus;
  handledByAI: boolean;
}

/** Full context that will be sent to the local Ollama model (once enabled). */
export interface AIAdvisorContext {
  restaurant: AIAdvisorRestaurantInfo;
  summary: AIAdvisorSummary;
  upcomingBookings: AIAdvisorUpcomingBooking[];
}

/* ------------------------------------------------------------------
   Helper – format a Date as YYYY‑MM‑DD (same format used by the DB).
   ------------------------------------------------------------------ */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------
   Build the AI Advisor context from known data.
   Returns undefined if required inputs are missing.
   ------------------------------------------------------------------ */
export async function buildAIAdvisorContext(
  bookings: Booking[],
  restaurant: Restaurant,
): Promise<AIAdvisorContext | undefined> {
  if (!bookings || !restaurant) return undefined;

  // ----- Restaurant info -------------------------------------------------
  const restaurantInfo: AIAdvisorRestaurantInfo = {
    name: restaurant.name,
    timezone: restaurant.timezone,
    maxPartySize: restaurant.max_party_size,
  };

  // ----- Date helpers ----------------------------------------------------
  const todayStr = formatDate(new Date());

  // ----- Summary calculations --------------------------------------------
  const statusCounts: Record<BookingStatus, number> = {
    Pending: 0,
    Confirmed: 0,
    Completed: 0,
    Cancelled: 0,
    "No-show": 0,
    Escalated: 0,
  };

  let todayBookings = 0;
  let upcomingBookings = 0;
  let aiHandledCount = 0;
  let noShowCount = 0;

  bookings.forEach((b) => {
    // status tally
    const s = b.status as BookingStatus;
    if (statusCounts[s] !== undefined) statusCounts[s] += 1;
    else statusCounts[s] = 1;

    // today count
    if (b.bookingDate === todayStr) todayBookings += 1;

    // upcoming count (future dates)
    if (b.bookingDate > todayStr) upcomingBookings += 1;

    // AI‑handled
    if (b.handledByAI) aiHandledCount += 1;

    // no‑show
    if (b.status === "No-show") noShowCount += 1;
  });

  const totalBookings = bookings.length;
  const noShowRate =
    totalBookings === 0 ? 0 : Math.round((noShowCount / totalBookings) * 100);

  const summary: AIAdvisorSummary = {
    totalBookings,
    todayBookings,
    upcomingBookings,
    statusCounts,
    aiHandledCount,
    noShowRate,
  };

  // ----- Minimal upcoming‑booking list ------------------------------------
  const minimalUpcoming: AIAdvisorUpcomingBooking[] = bookings
    .filter((b) => b.bookingDate >= todayStr) // include today and future
    .map((b) => ({
      bookingDate: b.bookingDate,
      bookingTime: b.bookingTime,
      partySize: b.partySize,
      status: b.status as BookingStatus,
      handledByAI: b.handledByAI,
    }));

  return {
    restaurant: restaurantInfo,
    summary,
    upcomingBookings: minimalUpcoming,
  };
}

/* ------------------------------------------------------------------
   Produce a human‑readable text block that can be used in a prompt.
   ------------------------------------------------------------------ */
export function formatAIAdvisorContext(context: AIAdvisorContext): string {
  const lines: string[] = [];

  lines.push(`Restaurant: ${context.restaurant.name}`);
  lines.push(`Timezone: ${context.restaurant.timezone}`);
  if (context.restaurant.maxPartySize)
    lines.push(`Max party size: ${context.restaurant.maxPartySize}`);

  lines.push("\nBookings Summary:");
  lines.push(`- Total bookings: ${context.summary.totalBookings}`);
  lines.push(`- Today's bookings: ${context.summary.todayBookings}`);
  lines.push(`- Upcoming bookings: ${context.summary.upcomingBookings}`);
  lines.push(`- AI‑handled bookings: ${context.summary.aiHandledCount}`);
  lines.push(`- No‑show rate: ${context.summary.noShowRate}%`);

  lines.push("\nStatus counts:");
  for (const [status, count] of Object.entries(context.summary.statusCounts)) {
    lines.push(`- ${status}: ${count}`);
  }

  lines.push("\nUpcoming bookings (minimal):");
  context.upcomingBookings.forEach((b, idx) => {
    lines.push(
      `${idx + 1}. ${b.bookingDate} ${b.bookingTime} – party ${b.partySize}, status ${b.status}, AI handled: ${b.handledByAI}`,
    );
  });

  return lines.join("\n");
}