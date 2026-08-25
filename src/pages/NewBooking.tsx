"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBooking } from "@/context/BookingContext";
import { showSuccess } from "@/utils/toast";
import Button from "@/components/common/Button";

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

  // ----- submit ------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // The BookingContext will fill id / timestamps automatically
    createBooking({
      customerName,
      phone,
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

  return (
    <section className="max-w-2xl mx-auto p-6 bg-card rounded-lg shadow">
      <h1 className="text-3xl font-bold mb-4 text-foreground">
        New Booking
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ---- Two‑column grid for larger screens ---- */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Customer Name */}
          <div className="flex flex-col">
            <label className="mb-1 font-medium text-foreground">
              Customer Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {/* Phone Number */}
          <div className="flex flex-col">
            <label className="mb-1 font-medium text-foreground">
              Phone Number <span className="text-destructive">*</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {/* Booking Date */}
          <div className="flex flex-col">
            <label className="mb-1 font-medium text-foreground">
              Booking Date <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              required
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {/* Booking Time */}
          <div className="flex flex-col">
            <label className="mb-1 font-medium text-foreground">
              Booking Time <span className="text-destructive">*</span>
            </label>
            <input
              type="time"
              required
              value={bookingTime}
              onChange={(e) => setBookingTime(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
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
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {/* Source */}
          <div className="flex flex-col">
            <label className="mb-1 font-medium text-foreground">Source</label>
            <select
              value={source}
              onChange={(e) =>
                setSource(e.target.value as typeof source)
              }
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
        <div className="flex justify-end space-x-3">
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