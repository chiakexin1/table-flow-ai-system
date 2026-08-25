// Strongly‑typed booking model for the TableFlow AI prototype

/** Allowed sources of a booking */
export type BookingSource = "WhatsApp" | "Website" | "Phone" | "Walk‑in";

/** Allowed status values for a booking */
export type BookingStatus =
  | "Pending"
  | "Confirmed"
  | "Completed"
  | "Cancelled"
  | "No‑show"
  | "Escalated";

/** Full booking record */
export interface Booking {
  /** Unique identifier (generated on client) */
  id: string;

  /** Customer name – required */
  customerName: string;

  /** Phone number – required */
  phone: string;

  /** Date of the booking (ISO string, e.g. “2024‑08‑30”) – required */
  bookingDate: string;

  /** Time of the booking (HH:mm, 24‑h) – required */
  bookingTime: string;

  /** Number of people – required, 1 – 20 */
  partySize: number;

  /** Optional special request from the customer */
  specialRequest?: string;

  /** Where the booking originated */
  source: BookingSource;

  /** Current booking status */
  status: BookingStatus;

  /** Did the AI already handle this enquiry? */
  handledByAI: boolean;

  /** Timestamp when the record was created (ISO string) */
  createdAt: string;

  /** Timestamp of the last update (ISO string) */
  updatedAt: string;
}