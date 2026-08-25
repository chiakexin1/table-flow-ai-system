"use client";

import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useBooking } from "@/context/BookingContext";
import { showSuccess } from "@/utils/toast";
import Button from "@/components/common/Button";

type FormData = {
  customerName: string;
  phone: string;
  bookingDate: string;
  bookingTime: string;
  partySize: number;
  source: "WhatsApp" | "Website" | "Phone" | "Walk‑in";
  specialRequest?: string;
  handledByAI: boolean;
};

export default function NewBooking() {
  const navigate = useNavigate();
  const { createBooking } = useBooking();

  // ----- form state -------------------------------------------------
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [source, setSource] = useState<"WhatsApp" | "Website" | "Phone" | "Walk‑in">(
    "WhatsApp",
  );
  const [specialRequest, setSpecialRequest] = useState("");
  const [handledByAI, setHandledByAI] = useState(false);
  const [loading, setLoading] = useState(false);

  // ----- validation errors -------------------------------------------
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {},
  );

  // refs for focusing first invalid input
  const refs = {
    customerName: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    bookingDate: useRef<HTMLInputElement>(null),
    bookingTime: useRef<HTMLInputElement>(null),
    partySize: useRef<HTMLInputElement>(null),
  };

  // ----- helpers -----------------------------------------------------
  const trim = (s: string) => s.trim();

  const validate = (): Partial<Record<keyof FormData, string>> => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    // Customer Name
    if (!trim(customerName)) {
      newErrors.customerName = "Customer name is required.";
    }

    // Phone Number
    const rawPhone = trim(phone);
    if (!rawPhone) {
      newErrors.phone = "Phone number is required.";
    } else {
      // simple phone regex: allow digits, spaces, +, -; length 7‑15
      const phoneRegex = /^[+]?[\d\s-]{7,15}$/;
      if (!phoneRegex.test(rawPhone)) {
        newErrors.phone = "Enter a valid phone number.";
      }
    }

    // Booking Date
    if (!bookingDate) {
      newErrors.bookingDate = "Booking date is required.";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // midnight today
      const selected = new Date(bookingDate);
      if (selected < today) {
        newErrors.bookingDate = "Booking date cannot be in the past.";
      }
    }

    // Booking Time
    if (!bookingTime) {
      newErrors.bookingTime = "Booking time is required.";
    }

    // Party Size
    if (!partySize || partySize < 1 || partySize > 20) {
      newErrors.partySize = "Party size must be between 1 and 20.";
    }

    // Source – the select guarantees a valid value, no extra check needed

    return newErrors;
  };

  const focusFirstError = (errObj: typeof errors) => {
    const order: (keyof FormData)[] = [
      "customerName",
      "phone",
      "bookingDate",
      "bookingTime",
      "partySize",
    ];
    for (const key of order) {
      if (errObj[key]) {
        // @ts-ignore – refs have matching keys
        refs[key].current?.focus();
        break;
      }
    }
  };

  // ----- submit ------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      focusFirstError(validationErrors);
      return;
    }

    setLoading(true);
    // Context will add id, timestamps, etc.
    createBooking({
      customerName: trim(customerName),
      phone: trim(phone),
      bookingDate,
      bookingTime,
      partySize,
      source,
      status: "Pending",
      handledByAI,
      specialRequest: specialRequest || undefined,
    });

    showSuccess("Booking created successfully");
    setLoading(false);
    navigate("/bookings");
  };

  // ----- cancel ------------------------------------------------------
  const handleCancel = () => {
    navigate("/bookings");
  };

  // ----- clear specific error when user edits that field -------------
  const clearError = (field: keyof FormData) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <section className="max-w-2xl mx-auto p-6 bg-card rounded-lg shadow">
      <h1 className="text-3xl font-bold mb-4 text-foreground">
        New Booking
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Two‑column grid for larger screens */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Customer Name */}
          <div className="flex flex-col">
            <label className="mb-1 font-medium text-foreground">
              Customer Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              ref={refs.customerName}
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                clearError("customerName");
              }}
              aria-invalid={!!errors.customerName}
              aria-describedby={errors.customerName ? "customerName-error" : undefined}
              className={`w-full rounded-md border px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                errors.customerName ? "border-destructive" : "border-input"
              }`}
            />
            {errors.customerName && (
              <p id="customerName-error" className="mt-1 text-sm text-destructive">
                {errors.customerName}
              </p>
            )}
          </div>

          {/* Phone Number */}
          <div className="flex flex-col">
            <label className="mb-1 font-medium text-foreground">
              Phone Number <span className="text-destructive">*</span>
            </label>
            <input
              type="tel"
              required
              ref={refs.phone}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                clearError("phone");
              }}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "phone-error" : undefined}
              className={`w-full rounded-md border px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                errors.phone ? "border-destructive" : "border-input"
              }`}
            />
            {errors.phone && (
              <p id="phone-error" className="mt-1 text-sm text-destructive">
                {errors.phone}
              </p>
            )}
          </div>

          {/* Booking Date */}
          <div className="flex flex-col">
            <label className="mb-1 font-medium text-foreground">
              Booking Date <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              required
              ref={refs.bookingDate}
              value={bookingDate}
              onChange={(e) => {
                setBookingDate(e.target.value);
                clearError("bookingDate");
              }}
              aria-invalid={!!errors.bookingDate}
              aria-describedby={errors.bookingDate ? "bookingDate-error" : undefined}
              className={`w-full rounded-md border px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                errors.bookingDate ? "border-destructive" : "border-input"
              }`}
            />
            {errors.bookingDate && (
              <p id="bookingDate-error" className="mt-1 text-sm text-destructive">
                {errors.bookingDate}
              </p>
            )}
          </div>

          {/* Booking Time */}
          <div className="flex flex-col">
            <label className="mb-1 font-medium text-foreground">
              Booking Time <span className="text-destructive">*</span>
            </label>
            <input
              type="time"
              required
              ref={refs.bookingTime}
              value={bookingTime}
              onChange={(e) => {
                setBookingTime(e.target.value);
                clearError("bookingTime");
              }}
              aria-invalid={!!errors.bookingTime}
              aria-describedby={errors.bookingTime ? "bookingTime-error" : undefined}
              className={`w-full rounded-md border px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                errors.bookingTime ? "border-destructive" : "border-input"
              }`}
            />
            {errors.bookingTime && (
              <p id="bookingTime-error" className="mt-1 text-sm text-destructive">
                {errors.bookingTime}
              </p>
            )}
          </div>

          {/* Party Size */}
          <div className="flex flex-col">
            <label className="mb-1 font-medium text-foreground">
              Party Size <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              required
              min={1}
              max={20}
              ref={refs.partySize}
              value={partySize}
              onChange={(e) => {
                setPartySize(Number(e.target.value));
                clearError("partySize");
              }}
              aria-invalid={!!errors.partySize}
              aria-describedby={errors.partySize ? "partySize-error" : undefined}
              className={`w-full rounded-md border px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                errors.partySize ? "border-destructive" : "border-input"
              }`}
            />
            {errors.partySize && (
              <p id="partySize-error" className="mt-1 text-sm text-destructive">
                {errors.partySize}
              </p>
            )}
          </div>

          {/* Source */}
          <div className="flex flex-col">
            <label className="mb-1 font-medium text-foreground">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="WhatsApp">WhatsApp</option>
              <option value="Website">Website</option>
              <option value="Phone">Phone</option>
              <option value="Walk‑in">Walk‑in</option>
            </select>
          </div>

          {/* Handled by AI */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="handledByAI"
              checked={handledByAI}
              onChange={(e) => setHandledByAI(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus-visible:ring-primary"
            />
            <label htmlFor="handledByAI" className="text-foreground">
              Handled by AI
            </label>
          </div>
        </div>

        {/* Special Request – full width */}
        <div className="flex flex-col">
          <label className="mb-1 font-medium text-foreground">
            Special Request
          </label>
          <textarea
            rows={3}
            value={specialRequest}
            onChange={(e) => setSpecialRequest(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="bg-muted text-muted-foreground hover:bg-muted/80"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create Booking"}
            </Button>
          </div>
        </form>
      </section>
    );
}